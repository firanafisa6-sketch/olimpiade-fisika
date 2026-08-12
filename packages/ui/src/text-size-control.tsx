"use client";

import { useEffect, useState } from "react";

type TextSize = "small" | "medium" | "large";

const options: Array<{ value: TextSize; label: string; ariaLabel: string; className: string }> = [
  { value: "small", label: "A", ariaLabel: "Ukuran teks kecil", className: "text-xs" },
  { value: "medium", label: "A", ariaLabel: "Ukuran teks sedang", className: "text-sm" },
  { value: "large", label: "A", ariaLabel: "Ukuran teks besar", className: "text-base" }
];

export function TextSizeControl() {
  const [size, setSize] = useState<TextSize>("medium");

  useEffect(() => {
    const saved = window.localStorage.getItem("seleksi-text-size") as TextSize | null;
    const initial = saved ?? "medium";
    setSize(initial);
    document.documentElement.dataset.fontSize = initial;
  }, []);

  function changeSize(next: TextSize) {
    setSize(next);
    document.documentElement.dataset.fontSize = next;
    window.localStorage.setItem("seleksi-text-size", next);
  }

  return (
    <div className="text-size-control" role="group" aria-label="Ukuran teks">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`text-size-button ${option.className} ${size === option.value ? "is-active" : ""}`}
          onClick={() => changeSize(option.value)}
          aria-pressed={size === option.value}
          aria-label={option.ariaLabel}
          title={option.ariaLabel}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
