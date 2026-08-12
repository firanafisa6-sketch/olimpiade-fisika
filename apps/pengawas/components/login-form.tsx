"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AppLogo } from "@/components/app-logo";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identity, setIdentity] = useState("");
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
        body: JSON.stringify({ identity, password })
      });

      const data = await response.json().catch(() => ({ message: "Login gagal." }));
      if (!response.ok) {
        setError(data.message ?? "Login gagal.");
        return;
      }

      const nextUrl = searchParams.get("next") || data.redirectTo || "/";
      router.replace(nextUrl.startsWith("/") ? nextUrl : "/");
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="login-card card" onSubmit={submit} autoComplete="off">
      <div className="login-brand-mark"><AppLogo /></div>
      <p className="eyebrow">Portal Pengawas</p>
      <h1>Masuk Dashboard Pengawas</h1>
      <p className="muted-text">Gunakan username pengawas yang digenerate admin, misalnya pgw_0001.</p>

      <label className="field-block">
        <span className="field-label">Username Pengawas</span>
        <input className="text-input" type="text" value={identity} onChange={(event) => setIdentity(event.target.value)} autoComplete="username" placeholder="pgw_0001" spellCheck={false} required />
      </label>

      <label className="field-block">
        <span className="field-label">Password</span>
        <input className="text-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Password pengawas" required />
      </label>

      {error ? <div className="login-error" role="alert">{error}</div> : null}

      <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? "Memeriksa..." : "Masuk"}</button>
    </form>
  );
}
