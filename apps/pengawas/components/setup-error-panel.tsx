export function SetupErrorPanel({ title = "Database aplikasi Pengawas belum siap", errorMessage }: { title?: string; errorMessage?: string }) {
  return (
    <section className="card panel setup-error-panel">
      <p className="eyebrow">Perlu sinkronisasi</p>
      <h2>{title}</h2>
      <p>
        Halaman Pengawas membutuhkan struktur database terbaru: ruang ujian, penugasan pengawas, dan catatan pelanggaran. Jalankan perintah berikut dari root project, lalu buka ulang localhost:3002.
      </p>
      <pre className="command-block"><code>{`npm run db:generate\nnpm run db:push\nnpm run dev:pengawas`}</code></pre>
      {errorMessage ? <p className="muted-text">Detail teknis: {errorMessage}</p> : null}
    </section>
  );
}
