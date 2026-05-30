import { History as HistoryIcon, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ScoreBadge } from "@/components/ProductCard";
import { toast } from "sonner";

interface ScanRow {
  id: string;
  barcode: string | null;
  product_name: string;
  brand: string | null;
  image_url: string | null;
  health_score: number;
  scanned_at: string;
  data: any;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

const HistoryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("scans")
      .select("*")
      .eq("user_id", user.id)
      .order("scanned_at", { ascending: false });
    if (error) { toast.error("Could not load history", { duration: 3000 }); }
    setItems((data as ScanRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("scans").delete().eq("id", id);
    if (error) { toast.error("Failed to delete", { duration: 3000 }); return; }
    setItems(items.filter(i => i.id !== id));
    setConfirmDeleteId(null);
    toast.success("Scan removed", { duration: 2500 });
  };

  const clearAll = async () => {
    if (!user) return;
    const { error } = await supabase.from("scans").delete().eq("user_id", user.id);
    if (error) { toast.error("Failed to clear history", { duration: 3000 }); return; }
    setItems([]);
    setConfirmClear(false);
    toast.success("History cleared", { duration: 2500 });
  };

  const handleItemClick = (item: ScanRow) => {
    const isOcr = item.data?.type === "ocr";
    if (isOcr) {
      // Navigate to results with OCR data in state
      navigate(`/results/${encodeURIComponent(item.barcode ?? "ocr-scan")}?nf=1`, {
        state: { ocrData: item.data },
      });
    } else {
      // Normal barcode product
      navigate(`/results/${encodeURIComponent(item.barcode ?? "")}`);
    }
  };

  if (loading) {
    return <div className="min-h-[50vh] grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="px-5 pt-2 pb-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">History</h1>
          <p className="text-sm text-muted-foreground">{items.length} scans</p>
        </div>
        {items.length > 0 && (
          <button onClick={() => setConfirmClear(true)} className="h-10 w-10 grid place-items-center rounded-full glass">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {confirmClear && (
        <div className="glass rounded-2xl p-4 shadow-card space-y-3">
          <p className="text-sm font-medium text-foreground">Clear all scan history?</p>
          <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={clearAll} className="flex-1 bg-danger text-white rounded-xl py-2 text-sm font-semibold">Delete All</button>
            <button onClick={() => setConfirmClear(false)} className="flex-1 glass rounded-xl py-2 text-sm font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center space-y-3 shadow-card">
          <div className="mx-auto h-16 w-16 rounded-full gradient-hero grid place-items-center shadow-glow">
            <HistoryIcon className="h-7 w-7 text-primary-foreground" />
          </div>
          <p className="font-semibold text-foreground">No scans yet</p>
          <p className="text-sm text-muted-foreground">Tap the scan button to analyze your first product.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => {
            const isOcr = s.data?.type === "ocr";
            return (
              <div key={s.id} className="space-y-1">
                <p className="text-xs text-muted-foreground px-1">{formatDate(s.scanned_at)}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleItemClick(s)} className="flex-1 flex items-center gap-3 gradient-card rounded-2xl p-3 shadow-card text-left">
                    <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted shrink-0">
                      {s.image_url ? <img src={s.image_url} alt={s.product_name} className="h-full w-full object-cover" /> : (
                        <div className="h-full w-full bg-primary/10 grid place-items-center text-primary text-xs font-bold">
                          {isOcr ? "OCR" : s.product_name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground truncate">{s.brand}</p>
                      <p className="text-sm font-semibold text-foreground truncate">{s.product_name}</p>
                    </div>
                    <ScoreBadge score={s.health_score} />
                  </button>
                  <button onClick={() => setConfirmDeleteId(s.id)} className="h-10 w-10 shrink-0 grid place-items-center rounded-full glass">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
                {confirmDeleteId === s.id && (
                  <div className="flex gap-2 px-1 mt-1">
                    <button onClick={() => deleteItem(s.id)} className="flex-1 bg-danger/90 text-white rounded-xl py-1.5 text-xs font-semibold">Delete</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="flex-1 glass rounded-xl py-1.5 text-xs font-semibold">Cancel</button>
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

export default HistoryPage;
