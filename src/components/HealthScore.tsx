import { cn } from "@/lib/utils";

interface Props {
  score: number;
  size?: number;
  className?: string;
}

export const HealthScore = ({ score, size = 160, className }: Props) => {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 70 ? "hsl(var(--success))" : score >= 45 ? "hsl(var(--warning))" : "hsl(var(--danger))";
  const label = score >= 70 ? "Good" : score >= 45 ? "Moderate" : "Poor";

  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          fill="none"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-4xl font-bold text-foreground tabular-nums">{score}</span>
        <span className="text-xs uppercase tracking-widest mt-1" style={{ color }}>{label}</span>
      </div>
    </div>
  );
};