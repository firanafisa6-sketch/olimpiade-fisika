import { NextResponse } from "next/server";
import { MAX_IMAGE_BYTES, validateImageMetadata } from "@seleksi/validation";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sesi tidak valid." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "File tidak ditemukan." }, { status: 400 });
  }

  try {
    validateImageMetadata({ size: file.size, type: file.type });
    return NextResponse.json({
      ok: true,
      metadata: { name: file.name, type: file.type, size: file.size, max: MAX_IMAGE_BYTES }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Gambar tidak valid." }, { status: 422 });
  }
}
