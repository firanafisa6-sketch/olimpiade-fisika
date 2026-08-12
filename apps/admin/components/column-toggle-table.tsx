"use client";

import { ChevronDown, ChevronUp, Columns3 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type Column = {
  key: string;
  label: string;
  index: number;
  locked?: boolean;
};

type ColumnToggleEventDetail = {
  storageKey: string;
  hidden: string[];
};

const COLUMN_EVENT = "soalflow-column-visibility";

export function ColumnToggleTable({
  children,
  columns,
  storageKey,
}: {
  children: ReactNode;
  columns: Column[];
  storageKey?: string;
}) {
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    const allowedKeys = new Set(
      columns.filter((column) => !column.locked).map((column) => column.key),
    );
    const normalize = (items: unknown[]) =>
      items.map(String).filter((key) => allowedKeys.has(key));

    if (!storageKey) return;

    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const normalized = normalize(parsed);
          setHidden(normalized);
          window.localStorage.setItem(storageKey, JSON.stringify(normalized));
        }
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }

    function sync(event: Event) {
      const detail = (event as CustomEvent<ColumnToggleEventDetail>).detail;
      if (detail?.storageKey === storageKey) setHidden(normalize(detail.hidden));
    }

    window.addEventListener(COLUMN_EVENT, sync);
    return () => window.removeEventListener(COLUMN_EVENT, sync);
  }, [storageKey]);

  function toggle(key: string) {
    if (columns.some((column) => column.key === key && column.locked)) return;

    const next = hidden.includes(key)
      ? hidden.filter((item) => item !== key)
      : [...hidden, key];

    setHidden(next);

    if (storageKey) {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent<ColumnToggleEventDetail>(COLUMN_EVENT, {
          detail: { storageKey, hidden: next },
        }),
      );
    }
  }

  const classNames = columns
    .filter((column) => !column.locked && hidden.includes(column.key))
    .map((column) => `hide-column-${column.index}`)
    .join(" ");

  return (
    <div className={`column-toggle-table ${classNames}`}>
      <div
        className="column-toggle-toolbar"
        aria-label="Tampilkan atau sembunyikan kolom"
      >
        <span className="column-toggle-label">
          <Columns3 size={16} /> Kolom
        </span>
        {columns.map((column) => {
          const isHidden = hidden.includes(column.key);
          return (
            <button
              key={column.key}
              className={`column-toggle-button ${isHidden ? "is-hidden" : ""}`}
              type="button"
              onClick={() => toggle(column.key)}
              disabled={column.locked}
              title={
                isHidden
                  ? `Tampilkan ${column.label}`
                  : `Sembunyikan ${column.label}`
              }
            >
              {column.label}
              {isHidden ? (
                <ChevronDown size={15} />
              ) : (
                <ChevronUp size={15} />
              )}
            </button>
          );
        })}
      </div>
      <div className="data-table-wrap">{children}</div>
    </div>
  );
}
