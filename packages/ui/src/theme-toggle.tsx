"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <button className="utility-button" aria-label="Mengubah tema">◐</button>;
  }

  const dark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      className="utility-button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Gunakan mode terang" : "Gunakan mode gelap"}
      title={dark ? "Mode terang" : "Mode gelap"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
