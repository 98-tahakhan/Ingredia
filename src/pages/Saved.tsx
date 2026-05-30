import { Heart, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ScoreBadge } from "@/components/ProductCard";
import { toast } from "sonner";

interface SavedRow {
  id: string;
  barcode: string | null;
  product_name: string;
  brand: string | null;
  image_url: string | null;
  health_score: number | null;
  data: any;
}

const Saved = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_alternatives")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) { toast.error("Could not load saved items"); }
    setItems((data as SavedRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("saved_alternatives").delete().eq("id", id);
    if (error) { toast.error("Failed to remove", { duration: 3000 }); return; }
    setItems(items.filter(i => i.id !== id));
    setConfirmId(null);
    toast.success("Removed from saved", { duration: 2500 });
  };

  if (loading) {
    return <div className="min-h-[50vh] grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="px-5 pt-2 pb-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Saved</h1>
        <p className="text-sm text-muted-foreground">{items.length} items bookmarked</p>
      </div>

      {items.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center space-y-3 shadow-card">
          <div className="mx-auto h-16 w-16 rounded-full gradient-hero grid place-items-center shadow-glow">
            <Heart className="h-7 w-7 text-primary-foreground" />
          </div>
          <p className="font-semibold text-foreground">Nothing saved yet</p>
          <p className="text-sm text-muted-foreground">Bookmark products from any analysis to find them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) => {
            const isOcr = p.data?.type === "ocr";
            const handleClick = () => {
              if (isOcr) {
                navigate(`/results/${encodeURIComponent(p.barcode ?? "ocr-scan")}?nf=1`, { state: { ocrData: p.data } });
              } else {
                navigate(`/results/${encodeURIComponent(p.barcode ?? "")}`);
              }
            };
            return (
              <div key={p.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <button onClick={handleClick} className="flex-1 flex items-center gap-3 gradient-card rounded-2xl p-3 shadow-card text-left">
                    <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted shrink-0">
                      {p.image_url ? <img src={p.image_url} alt={p.product_name} className="h-full w-full object-cover" /> : (
                        <div className="h-full w-full bg-primary/10 grid place-items-center text-primary text-xs font-bold">
                          {isOcr ? "OCR" : p.product_name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground truncate">{p.brand}</p>
                      <p className="text-sm font-semibold text-foreground truncate">{p.product_name}</p>
                    </div>
                    {p.health_score != null && <ScoreBadge score={p.health_score} />}
                  </button>
                  <button onClick={() => setConfirmId(p.id)} className="h-10 w-10 shrink-0 grid place-items-center rounded-full glass">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
                {confirmId === p.id && (
                  <div className="flex gap-2 px-1">
                    <button onClick={() => removeItem(p.id)} className="flex-1 bg-danger/90 text-white rounded-xl py-1.5 text-xs font-semibold">Remove</button>
                    <button onClick={() => setConfirmId(null)} className="flex-1 glass rounded-xl py-1.5 text-xs font-semibold">Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Saved;
