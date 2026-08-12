import type { SVGProps } from "react";

export function AppLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="Logo Olimpiade Fisika" {...props}>
      <defs>
        <linearGradient id="olimpiade-fisika-logo-gradient" x1="7" y1="6" x2="57" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1D4ED8" />
          <stop offset="0.48" stopColor="#2563EB" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="olimpiade-fisika-accent-gradient" x1="16" y1="12" x2="50" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#olimpiade-fisika-logo-gradient)" />
      <circle cx="27" cy="32" r="14" fill="none" stroke="white" strokeWidth="7" />
      <path d="M38 18h15M38 18v29M38 31h12" fill="none" stroke="url(#olimpiade-fisika-accent-gradient)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 47c9 5 22 4 31-3" fill="none" stroke="white" strokeOpacity="0.42" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
