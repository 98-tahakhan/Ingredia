import { Search, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { categories } from "@/data/mockData";
import { ScoreBadge } from "@/components/ProductCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import heroImg from "@/assets/hero-foods.jpg";

interface RecentScan {
  id: string;
  barcode: string | null;
  product_name: string;
  brand: string | null;
  image_url: string | null;
  health_score: number;
  data?: any;
}

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecentScan[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("scans").select("id,barcode,product_name,brand,image_url,health_score,data")
      .eq("user_id", user.id)
      .order("scanned_at", { ascending: false }).limit(5)
      .then(({ data }) => setRecent((data as any) ?? []));
  }, [user]);

  // Real-time search across scans and saved
  useEffect(() => {
    if (!user || !searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const q = searchQuery.trim().toLowerCase();

    const searchScans = supabase
      .from("scans")
      .select("id,barcode,product_name,brand,image_url,health_score,data")
      .eq("user_id", user.id)
      .or(`product_name.ilike.%${q}%,brand.ilike.%${q}%`)
      .order("scanned_at", { ascending: false })
      .limit(10);

    const searchSaved = supabase
      .from("saved_alternatives")
      .select("id,barcode,product_name,brand,image_url,health_score,data")
      .eq("user_id", user.id)
      .or(`product_name.ilike.%${q}%,brand.ilike.%${q}%`)
      .limit(10);

    Promise.all([searchScans, searchSaved]).then(([scansRes, savedRes]) => {
      const scans = (scansRes.data as RecentScan[]) ?? [];
      const saved = (savedRes.data as RecentScan[]) ?? [];
      // Deduplicate by barcode
      const seen = new Set<string>();
      const combined: RecentScan[] = [];
      for (const item of [...scans, ...saved]) {
        const key = item.barcode || item.id;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(item);
        }
      }
      setSearchResults(combined);
      setSearching(false);
    });
  }, [searchQuery, user]);

  const showSearch = searchQuery.trim().length > 0;

  return (
    <div className="px-5 pt-2 pb-8 space-y-7">
      <section className="space-y-4">
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground leading-tight">
          Decode What's Inside <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">Your Food</span>
        </h1>
        <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 shadow-card">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, brands…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-xs text-muted-foreground">✕</button>
          )}
        </div>
      </section>

      {/* Search Results */}
      {showSearch && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {searching ? "Searching..." : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`}
          </h2>
          {!searching && searchResults.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center shadow-card">
              <p className="text-sm text-muted-foreground">No products found for "{searchQuery}"</p>
              <p className="text-xs text-muted-foreground mt-1">Try scanning the product first</p>
            </div>
          )}
          <div className="space-y-2">
            {searchResults.map((s) => {
              const isOcr = s.data?.type === "ocr";
              const handleClick = () => {
                if (isOcr) {
                  navigate(`/results/${encodeURIComponent(s.barcode ?? "ocr-scan")}?nf=1`, { state: { ocrData: s.data } });
                } else {
                  navigate(`/results/${encodeURIComponent(s.barcode ?? "")}`);
                }
              };
              return (
                <button key={s.id} onClick={handleClick} className="w-full flex items-center gap-3 gradient-card rounded-2xl p-3 shadow-card text-left">
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
              );
            })}
          </div>
        </section>
      )}

      {/* Normal home content (hidden during search) */}
      {!showSearch && (
        <>
          <section className="relative overflow-hidden rounded-3xl shadow-glow">
            <img src={heroImg} alt="Healthy foods" width={1280} height={896} className="h-44 w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/80 via-primary/30 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-5 text-primary-foreground">
              <div className="flex items-center gap-1.5 text-xs font-medium opacity-90">
                <Sparkles className="h-3.5 w-3.5" /> Today's Pick
              </div>
              <p className="text-lg font-semibold leading-tight mt-1">Cleaner snacks, smarter choices</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Categories</h2>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">
              {categories.map((c) => (
                <button key={c.id} className="flex flex-col items-center gap-2 shrink-0 group">
                  <div className="h-20 w-20 rounded-2xl overflow-hidden gradient-card shadow-card group-hover:shadow-glow transition-shadow">
                    <img src={c.image} alt={c.label} loading="lazy" className="h-full w-full object-cover" />
                  </div>
                  <span className="text-xs font-medium text-foreground">{c.label}</span>
                </button>
              ))}
            </div>
          </section>

          {recent.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Recent Scans</h2>
                <Link to="/history" className="text-xs font-medium text-primary">See all</Link>
              </div>
              <div className="space-y-2">
                {recent.map((s) => {
                  const isOcr = s.data?.type === "ocr";
                  const handleClick = () => {
                    if (isOcr) {
                      navigate(`/results/${encodeURIComponent(s.barcode ?? "ocr-scan")}?nf=1`, { state: { ocrData: s.data } });
                    } else {
                      navigate(`/results/${encodeURIComponent(s.barcode ?? "")}`);
                    }
                  };
                  return (
                    <button key={s.id} onClick={handleClick} className="w-full flex items-center gap-3 gradient-card rounded-2xl p-3 shadow-card text-left">
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
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">How it works</h2>
            <div className="glass rounded-2xl p-4 shadow-card space-y-3">
              {[
                { n: "1", t: "Tap Scan", d: "Point your camera at any UPC/EAN barcode." },
                { n: "2", t: "Get analysis", d: "Real-time ingredient breakdown & health score." },
                { n: "3", t: "Save smarter swaps", d: "Bookmark healthier alternatives." },
              ].map((s) => (
                <div key={s.n} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full gradient-hero grid place-items-center text-primary-foreground text-sm font-bold shrink-0">{s.n}</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.t}</p>
                    <p className="text-xs text-muted-foreground">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Index;
