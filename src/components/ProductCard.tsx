import { Link } from "react-router-dom";
import type { Product } from "@/data/mockData";
import { HealthScore } from "./HealthScore";

export const ProductCardSmall = ({ product }: { product: Product }) => (
  <Link to={`/results/${product.id}`} className="block w-44 shrink-0 gradient-card glass rounded-3xl p-3 shadow-card hover:shadow-glow transition-shadow">
    <div className="aspect-square rounded-2xl overflow-hidden bg-muted mb-3">
      <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
    </div>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{product.brand}</p>
        <p className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">{product.name}</p>
      </div>
      <ScoreBadge score={product.healthScore} />
    </div>
  </Link>
);

export const ProductRow = ({ product, right }: { product: Product; right?: React.ReactNode }) => (
  <Link to={`/results/${product.id}`} className="flex items-center gap-3 gradient-card rounded-2xl p-3 shadow-card">
    <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted shrink-0">
      <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground truncate">{product.brand}</p>
      <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
    </div>
    {right ?? <ScoreBadge score={product.healthScore} />}
  </Link>
);

export const ScoreBadge = ({ score }: { score: number }) => {
  const color = score >= 70 ? "bg-success" : score >= 45 ? "bg-warning" : "bg-danger";
  return (
    <span className={`${color} text-white text-xs font-bold rounded-full px-2 py-1 shrink-0 tabular-nums shadow-sm`}>
      {score}
    </span>
  );
};

export { HealthScore };