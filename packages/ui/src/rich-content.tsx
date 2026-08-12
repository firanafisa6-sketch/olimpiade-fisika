import type { HTMLAttributes } from "react";

interface RichContentProps extends HTMLAttributes<HTMLDivElement> {
  html: string;
}

export function RichContent({ html, className = "", ...props }: RichContentProps) {
  return (
    <div
      className={`rich-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
      {...props}
    />
  );
}
