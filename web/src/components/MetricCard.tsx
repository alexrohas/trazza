import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
  featured?: boolean;
  tone?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
};

export function MetricCard({ featured = false, label, value, hint, tone = "neutral", icon }: MetricCardProps) {
  const TrendIcon = tone === "negative" ? ArrowDownRight : ArrowUpRight;

  return (
    <article className={`metric-card ${tone} ${featured ? "is-featured" : ""}`}>
      <div className="metric-card-topline">
        <span>{label}</span>
        <span className="metric-icon">{icon ?? <TrendIcon size={16} strokeWidth={2.2} />}</span>
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}
