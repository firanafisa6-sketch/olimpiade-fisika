import { ChevronDown, ClipboardList } from "lucide-react";

function content(value?: string | null) {
  return value?.trim() || "<p>-</p>";
}

export function BlueprintReferencePanel({
  code,
  testGroupHtml,
  testTopicHtml,
  indicatorHtml,
  materialHtml,
  gridHtml,
}: {
  code: string;
  testGroupHtml?: string | null;
  testTopicHtml?: string | null;
  indicatorHtml?: string | null;
  materialHtml?: string | null;
  gridHtml?: string | null;
}) {
  const rows = [
    ["Kelompok Uji", testGroupHtml],
    ["Topik Uji", testTopicHtml],
    ["Indikator", indicatorHtml],
    ["Materi Uji", materialHtml],
    ["Kisi-Kisi", gridHtml],
  ] as const;

  return (
    <details className="blueprint-reference-panel" open>
      <summary className="blueprint-reference-summary">
        <span>
          <ClipboardList size={17} />
          <span>
            <strong>Acuan kisi-kisi</strong>
            <small>{code}</small>
          </span>
        </span>
        <span className="blueprint-reference-toggle">
          <span className="reference-toggle-open">Sembunyikan</span>
          <span className="reference-toggle-closed">Tampilkan</span>
          <ChevronDown className="details-chevron" size={18} />
        </span>
      </summary>
      <div className="blueprint-reference-body">
        <table className="blueprint-reference-table">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>
                  <div
                    className="rich-preview blueprint-reference-content"
                    dangerouslySetInnerHTML={{ __html: content(value) }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
