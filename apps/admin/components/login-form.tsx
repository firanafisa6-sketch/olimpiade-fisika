"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AppLogo } from "@/components/app-logo";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json().catch(() => ({ message: "Login gagal." }));
      if (!response.ok) {
        setError(data.message ?? "Login gagal.");
        return;
      }

      const nextUrl = searchParams.get("next") || data.redirectTo || "/";
      if (nextUrl.startsWith("http://") || nextUrl.startsWith("https://")) {
        window.location.href = nextUrl;
        return;
      }
      router.replace(nextUrl.startsWith("/") ? nextUrl : "/");
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="login-card card" onSubmit={submit} autoComplete="off">
      <div className="login-brand-mark"><AppLogo /></div>
      <p className="eyebrow">Olimpiade Fisika Admin/Pengawas</p>
      <h1>Masuk ke Dashboard</h1>
      <p className="muted-text">Gunakan akun admin atau username pengawas yang telah digenerate.</p>

      <label className="field-block">
        <span className="field-label">Email / Username</span>
        <input
          className="text-input"
          type="text"
          name="seleksi-admin-email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
          placeholder="admin@olimpiadefisika.local atau pgw_0001"
          spellCheck={false}
          required
        />
      </label>

      <label className="field-block">
        <span className="field-label">Password</span>
        <input
          className="text-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          placeholder="Masukkan password admin"
          required
        />
      </label>

      {error ? <div className="login-error" role="alert">{error}</div> : null}

      <button className="primary-button" type="submit" disabled={isLoading}>
        {isLoading ? "Memeriksa..." : "Masuk"}
      </button>
    </form>
  );
}
