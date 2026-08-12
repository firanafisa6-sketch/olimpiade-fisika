interface ImageCacheBusterProps {
  /**
   * Prefix opsional untuk memudahkan identifikasi deployment.
   * Nilai unik per pembukaan halaman tetap dibuat otomatis di browser.
   */
  revisionPrefix?: string;
}

/**
 * Memaksa gambar Vercel Blob mengambil versi terbaru tanpa mengubah URL yang
 * tersimpan di database. Satu token unik dibuat setiap kali halaman dibuka,
 * lalu ditambahkan ke src/srcset setelah hydration selesai.
 */
export function ImageCacheBuster({ revisionPrefix = "" }: ImageCacheBusterProps) {
  const normalizedPrefix = revisionPrefix.trim();
  const serializedPrefix = JSON.stringify(normalizedPrefix).replace(/</g, "\\u003c");

  const script = `
(function () {
  var prefix = ${serializedPrefix};
  var parameterName = "__soalflow_image_revision";
  var blobHostSuffix = ".public.blob.vercel-storage.com";
  var activated = false;
  var observer;
  var revision = createRevision();

  function createRevision() {
    var uniquePart = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
    return prefix ? prefix + "-" + uniquePart : uniquePart;
  }

  function isVercelBlobUrl(url) {
    return url.hostname === "public.blob.vercel-storage.com" ||
      url.hostname.endsWith(blobHostSuffix);
  }

  function reviseUrl(rawUrl) {
    if (
      !rawUrl ||
      rawUrl.charAt(0) === "#" ||
      rawUrl.indexOf("data:") === 0 ||
      rawUrl.indexOf("blob:") === 0
    ) {
      return rawUrl;
    }

    try {
      var url = new URL(rawUrl, document.baseURI);
      if (!isVercelBlobUrl(url)) return rawUrl;
      if (url.searchParams.get(parameterName) === revision) return rawUrl;

      // Parameter lain, termasuk ?v=..., tetap dipertahankan.
      url.searchParams.set(parameterName, revision);
      return url.href;
    } catch (_error) {
      return rawUrl;
    }
  }

  function reviseSrcSet(rawSrcSet) {
    if (!rawSrcSet) return rawSrcSet;

    return rawSrcSet
      .split(",")
      .map(function (candidate) {
        var trimmed = candidate.trim();
        if (!trimmed) return candidate;

        var firstWhitespace = trimmed.search(/\\s/);
        var rawUrl = firstWhitespace === -1 ? trimmed : trimmed.slice(0, firstWhitespace);
        var descriptor = firstWhitespace === -1 ? "" : trimmed.slice(firstWhitespace);
        return reviseUrl(rawUrl) + descriptor;
      })
      .join(", ");
  }

  function patchElement(element) {
    if (element instanceof HTMLImageElement) {
      var source = element.getAttribute("src");
      var revisedSource = reviseUrl(source);
      if (source && revisedSource !== source) {
        element.setAttribute("src", revisedSource);
      }

      var imageSrcSet = element.getAttribute("srcset");
      var revisedImageSrcSet = reviseSrcSet(imageSrcSet);
      if (imageSrcSet && revisedImageSrcSet !== imageSrcSet) {
        element.setAttribute("srcset", revisedImageSrcSet);
      }
      return;
    }

    if (element instanceof HTMLSourceElement) {
      var sourceSrcSet = element.getAttribute("srcset");
      var revisedSourceSrcSet = reviseSrcSet(sourceSrcSet);
      if (sourceSrcSet && revisedSourceSrcSet !== sourceSrcSet) {
        element.setAttribute("srcset", revisedSourceSrcSet);
      }
    }
  }

  function patchTree(root) {
    if (root instanceof Element && (root.matches("img") || root.matches("source[srcset]"))) {
      patchElement(root);
    }

    if (root.querySelectorAll) {
      root.querySelectorAll("img, source[srcset]").forEach(patchElement);
    }
  }

  function activate() {
    if (activated) {
      patchTree(document);
      return;
    }

    activated = true;
    patchTree(document);

    observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === "attributes") {
          patchElement(mutation.target);
          return;
        }

        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === Node.ELEMENT_NODE) patchTree(node);
        });
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset"]
    });
  }

  function renewRevision() {
    revision = createRevision();
    patchTree(document);
  }

  // Jalankan setelah hydration agar React tidak mengembalikan atribut src lama.
  if (document.readyState === "complete") {
    setTimeout(activate, 0);
  } else {
    window.addEventListener("load", activate, { once: true });
  }

  // Saat halaman dipulihkan dari back-forward cache, buat token baru lagi.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      setTimeout(renewRevision, 0);
    }
  });
})();`;

  return (
    <script
      id="soalflow-image-cache-buster"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
