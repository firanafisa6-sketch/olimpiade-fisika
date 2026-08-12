"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Cetak" }: { label?: string }) {
  return (
    <button className="primary-button no-print" type="button" onClick={() => window.print()}>
      <Printer size={16} /> {label}
    </button>
  );
}
