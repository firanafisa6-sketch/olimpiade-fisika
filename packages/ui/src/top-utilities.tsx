"use client";

import { TextSizeControl } from "./text-size-control";
import { ThemeToggle } from "./theme-toggle";

export function TopUtilities() {
  return (
    <div className="top-utilities">
      <TextSizeControl />
      <ThemeToggle />
    </div>
  );
}
