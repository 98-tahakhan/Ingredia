import { Link, useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { ArrowLeft, Camera, ChevronDown, Heart, Loader2, Share2, Sparkles, Upload } from "lucide-react";
import { HealthScore } from "@/components/HealthScore";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  scanBarcode,
  askAI,
  scanIngredientImage,
  type ProductData,
  type AlternativeProduct,
  type HealthAnalysis,
  type ScanResult,
} from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { addNotification } from "@/lib/notifications";

const riskStyles = {
  green: { dot: "bg-success", label: "Safe", bg: "bg-success/10", text: "text-success" },
  yellow: { dot: "bg-warning", label: "Moderate", bg: "bg-warning/10", text: "text-warning" },
  red: { dot: "bg-danger", label: "High", bg: "bg-danger/10", text: "text-danger" },
} as const;

const Results = () => {
  const { barcode } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const isNotFound = params.get("nf") === "1";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openNote, setOpenNote] = useState<number | null>(0);
  const [saved, setSaved] = useState(false);
  const [alts, setAlts] = useState<AlternativeProduct[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiQuestion, setAiQuestion] = useState("");

  // OCR state
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrResult, setOcrResult] = useState<{ text: string; analysis: HealthAnalysis } | null>(null);
  const [ocrSaved, setOcrSaved] = useState(false);
  const [ocrProductName, setOcrProductName] = useState("");
  const [ocrHistorySaved, setOcrHistorySaved] = useState(false);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  // Restore OCR data from navigation state (when opening saved OCR items)
  useEffect(() => {
    const state = location.state as any;
    if (state?.ocrData?.type === "ocr" && state.ocrData.analysis) {
      setOcrResult({ text: state.ocrData.ingredients_text || "", analysis: state.ocrData.analysis });
      setOcrProductName(state.ocrData.product_name || "");
      setOcrSaved(true);
      setOcrHistorySaved(true);
    }
  }, [location.state]);

  useEffect(() => {
    if (!barcode || isNotFound) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const result: ScanResult = await scanBarcode(barcode);
        if (result.found && result.product) {
          setProduct(result.product);
          setAlts(result.alternatives || []);
        }
      } catch (e) {
        // Product fetch failed silently — will show not-found UI
      }
      setLoading(false);
      if (user && barcode) {
        const { data } = await supabase.from("saved_alternatives").select("id").eq("user_id", user.id).eq("barcode", barcode).maybeSingle();
        setSaved(!!data);
      }
    })();
  }, [barcode, isNotFound, user]);

  // ─── OCR Handler ─────────────────────────────────────────────────────────
  const handleOCRFile = async (file: File) => {
    setOcrBusy(true);
    try {
      const result = await scanIngredientImage(file);
      if (result.success && result.analysis) {
        setOcrResult({ text: result.extracted_text, analysis: result.analysis });
        toast.success("Ingredients analyzed! Enter a product name to save.");
        addNotification("OCR analysis completed", "ocr");
      } else {
        toast.error(result.extracted_text || "Could not identify ingredients. Try a clearer photo.");
      }
    } catch (e: any) {
      toast.error(e.message || "OCR failed. Check network connection to backend.");
    } finally {
      setOcrBusy(false);
    }
  };

  // ─── AI Handler (works for both barcode and OCR results) ─────────────────
  const handleAskAI = async (customQuestion?: string) => {
    const ingredientsText = product?.ingredientsText || ocrResult?.text || "";
    const productName = product?.name || "OCR Scanned Product";
    const brand = product?.brand || "Unknown";
    const score = product?.analysis.score || ocrResult?.analysis.score || 50;

    if (!ingredientsText) { toast.error("No ingredients to analyze"); return; }

    setAiBusy(true);
    setAiAnswer(null);
    try {
      const answer = await askAI({
        product_name: productName,
        brand: brand,
        ingredients_text: ingredientsText,
        score: score,
        question: customQuestion || undefined,
      });
      setAiAnswer(answer);
    } catch (e: any) {
      toast.error(e.message ?? "AI is unavailable right now");
    } finally {
      setAiBusy(false);
    }
  };

  // ─── Save OCR result ─────────────────────────────────────────────────────
  const saveOcrToHistory = async () => {
    if (!user || !ocrResult) return;
    if (!ocrProductName.trim()) { toast.error("Please enter a product name"); return; }
    const { error } = await supabase.from("scans").insert({
      user_id: user.id,
      barcode: barcode || "ocr-scan",
      product_name: ocrProductName.trim(),
      brand: "OCR Scan",
      image_url: null,
      health_score: ocrResult.analysis.score,
      data: { type: "ocr", product_name: ocrProductName.trim(), ingredients_text: ocrResult.text, analysis: ocrResult.analysis } as any,
    });
    if (error) { toast.error("Failed to save to history"); return; }
    setOcrHistorySaved(true);
    toast.success("Saved to history!");
    addNotification(`Scanned: ${ocrProductName.trim()}`, "scan");
  };

  const saveOcrResult = async () => {
    if (!user || !ocrResult) { toast.error("Sign in to save"); return; }
    if (!ocrProductName.trim()) { toast.error("Please enter a product name"); return; }
    const { error } = await supabase.from("saved_alternatives").insert({
      user_id: user.id,
      barcode: barcode || "ocr-scan",
      product_name: ocrProductName.trim(),
      brand: "OCR Scan",
      image_url: null,
      health_score: ocrResult.analysis.score,
      data: { type: "ocr", product_name: ocrProductName.trim(), ingredients_text: ocrResult.text, analysis: ocrResult.analysis } as any,
    });
    if (error) { toast.error("Failed to save"); return; }
    setOcrSaved(true);
    toast.success("Saved to bookmarks!");
    addNotification(`Saved: ${ocrProductName.trim()}`, "save");
  };

  // ─── AI Section Component (reused for both barcode and OCR) ──────────────
  const AISection = () => (
    <section className="px-5 mt-7 space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Ask AI</h2>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {["Is this safe daily?", "Explain risky ingredients", "Suggest healthier alternatives"].map((q) => (
          <button
            key={q}
            onClick={() => { setAiQuestion(q); handleAskAI(q); }}
            disabled={aiBusy}
            className="shrink-0 glass rounded-full px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (aiQuestion.trim()) handleAskAI(aiQuestion.trim()); }}
        className="glass rounded-2xl p-2 flex gap-2 shadow-card"
      >
        <input
          value={aiQuestion}
          onChange={(e) => setAiQuestion(e.target.value)}
          placeholder="Ask about ingredients..."
          className="flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/60"
          disabled={aiBusy}
        />
        <button
          type="submit"
          disabled={aiBusy || !aiQuestion.trim()}
          className="gradient-hero rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 flex items-center gap-1.5"
        >
          {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Ask
        </button>
      </form>
      {aiAnswer && (
        <div className="glass rounded-2xl p-4 shadow-card space-y-2">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{aiAnswer}</p>
          <p className="text-[10px] text-muted-foreground italic">AI-generated guidance. Consult a nutritionist for personalized advice.</p>
        </div>
      )}
    </section>
  );

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  // ─── Product Not Found (show OCR option) ─────────────────────────────────
  if ((isNotFound || !product) && !ocrResult) {
    return (
      <div className="px-5 pt-6 pb-8 space-y-6">
        <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full glass grid place-items-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="glass rounded-3xl p-8 text-center space-y-4 shadow-card">
          <div className="mx-auto h-16 w-16 rounded-full gradient-hero grid place-items-center shadow-glow">
            <Upload className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Product not found</p>
            <p className="text-sm text-muted-foreground mt-1">Barcode <span className="font-mono">{barcode}</span> isn't in our database yet.</p>
          </div>
          <p className="text-sm text-muted-foreground">Take a photo of the ingredients label and we'll analyze it for you.</p>
          <button
            onClick={() => ocrInputRef.current?.click()}
            disabled={ocrBusy}
            className="w-full gradient-hero rounded-2xl py-3.5 font-semibold text-primary-foreground shadow-glow flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {ocrBusy ? <><Loader2 className="h-5 w-5 animate-spin" /> Analyzing...</> : <><Camera className="h-5 w-5" /> Scan Ingredients Label</>}
          </button>
          <p className="text-[11px] text-muted-foreground">Works best with clear, well-lit photos of the ingredient list</p>
        </div>
        <Link to="/scan" className="block text-center text-sm font-medium text-primary">Try another scan</Link>
        <input ref={ocrInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleOCRFile(e.target.files[0]); e.target.value = ""; }} />
      </div>
    );
  }

  // ─── OCR Results ─────────────────────────────────────────────────────────
  if (ocrResult && !product) {
    const score = ocrResult.analysis.score;
    return (
      <div className="pb-8">
        <div className="relative">
          <div className="h-48 gradient-hero rounded-b-[2.5rem] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/60" />
            <div className="relative flex items-center justify-between px-5 pt-5">
              <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full glass grid place-items-center text-primary-foreground">
                <ArrowLeft className="h-5 w-5" />
              </button>
            </div>
            <div className="absolute bottom-5 left-5 right-5 text-primary-foreground">
              <p className="text-xs uppercase tracking-widest opacity-80">Scanned via OCR</p>
              <h1 className="text-2xl font-bold leading-tight mt-1">
                {ocrProductName || "Ingredient Analysis"}
              </h1>
            </div>
          </div>
          <div className="-mt-12 mx-5 glass rounded-3xl p-5 flex items-center gap-5 shadow-soft">
            <HealthScore score={score} size={120} />
            <div className="flex-1 space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Health Score</p>
              <p className="text-sm text-foreground leading-snug">
                {score >= 70 ? "A solid pick. Enjoy without much worry." : score >= 45 ? "Okay in moderation. Watch the additives." : "Heavily processed. Look for safer alternatives."}
              </p>
            </div>
          </div>
        </div>

        {/* Product Name Input */}
        {!ocrHistorySaved && (
          <section className="px-5 mt-5">
            <div className="glass rounded-2xl p-4 shadow-card space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Product Name *
              </label>
              <input
                value={ocrProductName}
                onChange={(e) => setOcrProductName(e.target.value)}
                placeholder="e.g. Pepsi Black, Maggi Masala, Kurkure..."
                className="w-full bg-transparent border-b border-border/50 pb-2 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary transition-colors"
              />
              <button
                onClick={saveOcrToHistory}
                disabled={!ocrProductName.trim() || ocrHistorySaved}
                className="w-full gradient-hero rounded-xl py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 mt-2"
              >
                {ocrHistorySaved ? "Saved to History ✓" : "Save to History"}
              </button>
            </div>
          </section>
        )}

        {ocrHistorySaved && (
          <section className="px-5 mt-5">
            <div className="glass rounded-2xl p-3 shadow-card flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-success/20 grid place-items-center">
                <span className="text-success text-sm">✓</span>
              </div>
              <p className="text-sm text-foreground font-medium">{ocrProductName} — saved to history</p>
            </div>
          </section>
        )}

        <section className="px-5 mt-7 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Ingredient Breakdown</h2>
          <div className="space-y-2">
            {ocrResult.analysis.ingredients.map((ing, i) => {
              const s = riskStyles[ing.risk];
              return (
                <div key={i} className="glass rounded-2xl p-3 flex items-center gap-3 shadow-card">
                  <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", s.dot)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ing.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{ing.note}</p>
                  </div>
                  <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full", s.bg, s.text)}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {ocrResult.analysis.notes.length > 0 && (
          <section className="px-5 mt-7 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Health Notes</h2>
            <div className="space-y-2">
              {ocrResult.analysis.notes.map((n, i) => (
                <div key={i} className="glass rounded-2xl p-4 shadow-card">
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI Section for OCR */}
        <AISection />

        <section className="px-5 mt-7">
          <div className="glass rounded-2xl p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Extracted Ingredients</p>
            <p className="text-sm text-foreground leading-relaxed">{ocrResult.text}</p>
          </div>
        </section>

        <div className="px-5 mt-8 flex gap-3">
          <button
            onClick={saveOcrResult}
            disabled={ocrSaved || !ocrProductName.trim()}
            className={cn("h-14 w-14 rounded-2xl grid place-items-center shadow-card transition-colors", ocrSaved ? "bg-danger text-white" : "glass text-foreground", !ocrProductName.trim() && "opacity-40")}
            title={!ocrProductName.trim() ? "Enter product name first" : "Save to bookmarks"}
          >
            <Heart className={cn("h-5 w-5", ocrSaved && "fill-current")} />
          </button>
          <Link to="/scan" className="flex-1 gradient-hero rounded-2xl py-4 text-center font-semibold text-primary-foreground shadow-glow">
            Scan Another
          </Link>
        </div>
      </div>
    );
  }

  // ─── Product Found — Full Results ────────────────────────────────────────
  if (!product) return null;

  const toggleSave = async () => {
    if (!user) { toast.error("Sign in to save"); return; }
    if (saved) {
      const { error } = await supabase.from("saved_alternatives").delete().eq("user_id", user.id).eq("barcode", product.barcode);
      if (error) { toast.error("Failed to remove"); return; }
      setSaved(false);
      toast.success("Removed from saved");
    } else {
      const { error } = await supabase.from("saved_alternatives").insert({
        user_id: user.id,
        barcode: product.barcode,
        product_name: product.name,
        brand: product.brand,
        image_url: product.image,
        health_score: product.analysis.score,
        data: product as any,
      });
      if (error) { toast.error("Failed to save: " + error.message); return; }
      setSaved(true);
      toast.success("Saved!");
      addNotification(`Saved: ${product.name}`, "save");
    }
  };

  const score = product.analysis.score;

  return (
    <div className="pb-8">
      <div className="relative">
        <div className="h-64 gradient-hero rounded-b-[2.5rem] relative overflow-hidden">
          <img src={product.image} alt={product.name} className="absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/20 to-primary/60" />
          <div className="relative flex items-center justify-between px-5 pt-5">
            <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full glass grid place-items-center text-primary-foreground"><ArrowLeft className="h-5 w-5" /></button>
            <button className="h-10 w-10 rounded-full glass grid place-items-center text-primary-foreground"><Share2 className="h-5 w-5" /></button>
          </div>
          <div className="absolute bottom-5 left-5 right-5 text-primary-foreground">
            <p className="text-xs uppercase tracking-widest opacity-80">{product.brand}</p>
            <h1 className="text-2xl font-bold leading-tight mt-1">{product.name}</h1>
          </div>
        </div>
        <div className="-mt-16 mx-5 glass rounded-3xl p-5 flex items-center gap-5 shadow-soft">
          <HealthScore score={score} size={120} />
          <div className="flex-1 space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Health Score</p>
            <p className="text-sm text-foreground leading-snug">
              {score >= 70 ? "A solid pick. Enjoy without much worry." : score >= 45 ? "Okay in moderation. Watch the additives." : "Heavily processed. Look for safer alternatives below."}
            </p>
          </div>
        </div>
      </div>

      <section className="px-5 mt-7 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Ingredient Breakdown</h2>
        <div className="space-y-2">
          {product.analysis.ingredients.map((ing, i) => {
            const s = riskStyles[ing.risk];
            return (
              <div key={i} className="glass rounded-2xl p-3 flex items-center gap-3 shadow-card">
                <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", s.dot)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ing.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{ing.note}</p>
                </div>
                <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full", s.bg, s.text)}>{s.label}</span>
              </div>
            );
          })}
          {product.analysis.ingredients.length === 0 && <p className="text-sm text-muted-foreground">No ingredient list available.</p>}
        </div>
      </section>

      {product.analysis.notes.length > 0 && (
        <section className="px-5 mt-7 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Health Notes</h2>
          <div className="space-y-2">
            {product.analysis.notes.map((n, i) => (
              <button key={i} onClick={() => setOpenNote(openNote === i ? null : i)} className="w-full text-left glass rounded-2xl p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", openNote === i && "rotate-180")} />
                </div>
                {openNote === i && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{n.body}</p>}
              </button>
            ))}
          </div>
        </section>
      )}

      <AISection />

      {alts.length > 0 && (
        <section className="mt-7 space-y-3">
          <div className="px-5"><h2 className="text-lg font-semibold text-foreground">Safer Alternatives</h2></div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-5 pb-2">
            {alts.map((p) => (
              <Link key={p.barcode} to={`/results/${encodeURIComponent(p.barcode)}`} className="block w-44 shrink-0 gradient-card glass rounded-3xl p-3 shadow-card">
                <div className="aspect-square rounded-2xl overflow-hidden bg-muted mb-3">
                  {p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-muted" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">{p.brand}</p>
                <p className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">{p.name}</p>
                <span className={cn("inline-block mt-2 text-xs font-bold text-white rounded-full px-2 py-0.5", p.health_score >= 70 ? "bg-success" : p.health_score >= 45 ? "bg-warning" : "bg-danger")}>{p.health_score}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="px-5 mt-8 flex gap-3">
        <button onClick={toggleSave} className={cn("h-14 w-14 rounded-2xl grid place-items-center shadow-card transition-colors", saved ? "bg-danger text-white" : "glass text-foreground")}>
          <Heart className={cn("h-5 w-5", saved && "fill-current")} />
        </button>
        <Link to="/scan" className="flex-1 gradient-hero rounded-2xl py-4 text-center font-semibold text-primary-foreground shadow-glow">Scan Another</Link>
      </div>
    </div>
  );
};

export default Results;
