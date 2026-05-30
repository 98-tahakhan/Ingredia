import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { scanBarcode } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { addNotification } from "@/lib/notifications";

const steps = [
  "Scanning barcode…",
  "Fetching product data…",
  "Analyzing ingredients…",
];

const Processing = () => {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!barcode) return;
    let cancelled = false;

    (async () => {
      const start = Date.now();
      setStep(0);
      await new Promise((r) => setTimeout(r, 250));
      if (cancelled) return;

      setStep(1);
      let result;
      try {
        result = await scanBarcode(barcode);
      } catch (e: any) {
        toast.error(e.message || "Network error. Check your connection.");
        if (!cancelled) navigate(`/results/${encodeURIComponent(barcode)}?nf=1`, { replace: true });
        return;
      }
      if (cancelled) return;

      setStep(2);
      await new Promise((r) => setTimeout(r, 300));

      if (!result.found || !result.product) {
        const elapsed = Date.now() - start;
        await new Promise((r) => setTimeout(r, Math.max(0, 700 - elapsed)));
        navigate(`/results/${encodeURIComponent(barcode)}?nf=1`, { replace: true });
        return;
      }

      // Save scan to Supabase history (with error handling)
      if (user) {
        const product = result.product;
        const { error: insertError } = await supabase.from("scans").insert({
          user_id: user.id,
          barcode: product.barcode,
          product_name: product.name,
          brand: product.brand,
          image_url: product.image,
          health_score: product.analysis.score,
          data: product as any,
        });
        if (insertError) {
          // History save failed — non-blocking, scan still works
        } else {
          addNotification(`Scanned: ${product.name}`, "scan");
        }
      }

      const elapsed = Date.now() - start;
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - elapsed)));
      if (!cancelled) navigate(`/results/${encodeURIComponent(barcode)}`, { replace: true });
    })();

    return () => { cancelled = true; };
  }, [barcode, navigate, user]);

  return (
    <div className="min-h-screen grid place-items-center px-8">
      <div className="w-full max-w-sm space-y-10 text-center">
        <div className="relative mx-auto h-32 w-32">
          <div className="absolute inset-0 rounded-full gradient-hero animate-pulse-ring" />
          <div className="absolute inset-0 rounded-full gradient-hero shadow-glow grid place-items-center">
            <Loader2 className="h-12 w-12 text-primary-foreground animate-spin" />
          </div>
        </div>
        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={s} className={`flex items-center gap-3 transition-opacity ${i <= step ? "opacity-100" : "opacity-30"}`}>
              <div className={`h-6 w-6 rounded-full grid place-items-center ${i < step ? "bg-success" : i === step ? "bg-primary" : "bg-muted"}`}>
                {i < step ? <Check className="h-3.5 w-3.5 text-white" /> : i === step ? <div className="h-2 w-2 rounded-full bg-primary-foreground animate-pulse" /> : null}
              </div>
              <p className="text-sm font-medium text-foreground">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Processing;
