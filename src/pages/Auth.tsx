import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Mail, Lock } from "lucide-react";

const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to verify, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error("Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-background flex flex-col px-6 py-10">
      <div className="flex-1 flex flex-col justify-center space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-[#0a1a0f] grid place-items-center shadow-glow">
            <svg width="40" height="40" viewBox="0 0 120 120" fill="none">
              <rect x="25" y="60" width="6" height="40" rx="1.5" fill="#15803D" />
              <rect x="35" y="52" width="6" height="48" rx="1.5" fill="#15803D" />
              <rect x="45" y="44" width="6" height="56" rx="1.5" fill="#16A34A" />
              <rect x="55" y="36" width="6" height="64" rx="1.5" fill="#22C55E" />
              <rect x="65" y="42" width="6" height="58" rx="1.5" fill="#22C55E" />
              <rect x="75" y="52" width="6" height="48" rx="1.5" fill="#16A34A" />
              <rect x="85" y="60" width="6" height="40" rx="1.5" fill="#15803D" />
              <circle cx="38" cy="28" r="4" fill="#22C55E" />
              <circle cx="55" cy="14" r="4" fill="#22C55E" />
              <circle cx="68" cy="6" r="3" fill="#86EFAC" />
              <path d="M68 38 C78 18, 100 10, 108 7 C105 18, 95 32, 78 44 C90 28, 100 18, 105 12 C95 18, 82 30, 73 42 Z" fill="#22C55E" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Ingredia</h1>
            <p className="text-sm text-muted-foreground mt-1">Decode what's inside your food</p>
          </div>
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3 shadow-card">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3 shadow-card">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            disabled={busy}
            type="submit"
            className="w-full gradient-hero rounded-2xl py-4 font-semibold text-primary-foreground shadow-glow disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full glass rounded-2xl py-3.5 font-semibold text-foreground shadow-card flex items-center justify-center gap-3"
        >
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.5 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C41 35.2 44 30 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
          Continue with Google
        </button>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-primary font-semibold"
          >
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;