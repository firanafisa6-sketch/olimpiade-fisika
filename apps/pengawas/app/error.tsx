"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="login-page">
      <section className="login-card card setup-error-panel">
        <p className="eyebrow">Portal Pengawas</p>
        <h1>Halaman Pengawas belum bisa dibuka</h1>
        <p>
          Kemungkinan besar Prisma client atau database belum disinkronkan setelah revisi sesi/ruang. Jalankan perintah berikut dari root project.
        </p>
        <pre className="command-block"><code>{`npm run db:generate\nnpm run db:push\nnpm run dev:pengawas`}</code></pre>
        <p className="muted-text">Detail teknis: {error.message}</p>
        <button className="primary-button" type="button" onClick={() => reset()}>Coba lagi</button>
      </section>
    </main>
  );
}
