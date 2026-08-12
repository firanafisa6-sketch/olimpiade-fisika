"use client";

import { useActionState } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { loginParticipant, type LoginState } from "@/app/actions";

const initialState: LoginState = {};

export function ParticipantLoginForm() {
  const [state, action, pending] = useActionState(loginParticipant, initialState);
  return (
    <form action={action} className="participant-login-form">
      <label className="field-block">
        <span className="field-label">Username peserta</span>
        <input className="text-input" name="username" autoComplete="username" placeholder="Nomor atau kode peserta" required />
      </label>
      <label className="field-block">
        <span className="field-label">Password</span>
        <input className="text-input" name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? <p className="login-error">{state.error}</p> : null}
      <button className="primary-button exam-login-button" type="submit" disabled={pending}>
        <LogIn size={18} /> {pending ? "Memeriksa..." : "Masuk ke ujian"}
      </button>
      <div className="login-security-note"><ShieldCheck size={17} /><span>Akun hanya dapat melihat paket yang diplot oleh admin.</span></div>
    </form>
  );
}
