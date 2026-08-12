import type { LucideIcon } from "lucide-react";

export function DashboardCard({ icon: Icon, value, label, tone = "default" }: { icon: LucideIcon; value: string; label: string; tone?: "default" | "warning" | "accent" }) {
  return (
    <article className={`card metric-card ${tone}`}>
      <div className="metric-icon"><Icon size={21} /></div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </article>
  );
}
