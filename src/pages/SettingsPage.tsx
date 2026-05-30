import { Bell, ChevronRight, FileText, Info, LogOut, Moon, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Row = ({ icon: Icon, label, right, onClick }: any) => (
  <button onClick={onClick} className="w-full flex items-center gap-4 px-4 py-3.5 text-left">
    <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center">
      <Icon className="h-4.5 w-4.5" />
    </div>
    <p className="flex-1 text-sm font-medium text-foreground">{label}</p>
    {right ?? <ChevronRight className="h-4 w-4 text-muted-foreground" />}
  </button>
);

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [notif, setNotif] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("ingredia-dark", dark ? "1" : "0");
  }, [dark]);

  useEffect(() => {
    // Load dark mode from localStorage on mount
    const saved = localStorage.getItem("ingredia-dark");
    if (saved === "1") setDark(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, notifications_enabled, dark_mode").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDisplayName(data.display_name ?? "");
        setNotif(data.notifications_enabled ?? true);
        if (data.dark_mode !== null) setDark(data.dark_mode);
      });
  }, [user]);

  const persist = async (patch: { display_name?: string; notifications_enabled?: boolean; dark_mode?: boolean }) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...patch }, { onConflict: "id" });
    if (error) { /* Settings save failed — non-critical */ }
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/auth", { replace: true });
  };

  const initial = (displayName || user?.user_metadata?.full_name || user?.email || "?").charAt(0).toUpperCase();
  const name = displayName || user?.user_metadata?.full_name || user?.user_metadata?.name || "";

  return (
    <div className="px-5 pt-2 pb-8 space-y-6">
      <div className="flex flex-col items-center text-center space-y-3 py-4">
        <div className="h-20 w-20 rounded-full gradient-hero grid place-items-center text-2xl font-bold text-primary-foreground shadow-glow">{initial}</div>
        <div>
          <p className="font-semibold text-foreground">{name || "Welcome"}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Profile</p>
        <div className="glass rounded-2xl p-3 shadow-card">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={() => persist({ display_name: displayName })}
            placeholder="Display name"
            className="w-full bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Preferences</p>
        <div className="glass rounded-2xl divide-y divide-border/40 shadow-card">
          <Row icon={Moon} label="Dark mode" right={<Switch checked={dark} onCheckedChange={(v: boolean) => { setDark(v); persist({ dark_mode: v }); }} />} />
          <Row icon={Bell} label="Notifications" right={<Switch checked={notif} onCheckedChange={(v: boolean) => { setNotif(v); persist({ notifications_enabled: v }); }} />} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">About</p>
        <div className="glass rounded-2xl divide-y divide-border/40 shadow-card">
          <Row icon={Info} label="About Ingredia" onClick={() => navigate("/about")} />
          <Row icon={FileText} label="Disclaimer" onClick={() => navigate("/disclaimer")} />
          <Row icon={Shield} label="Privacy Policy" onClick={() => navigate("/privacy")} />
        </div>
      </div>

      {!confirmLogout ? (
        <button
          onClick={() => setConfirmLogout(true)}
          className="w-full glass rounded-2xl py-3.5 font-semibold text-danger shadow-card flex items-center justify-center gap-2"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      ) : (
        <div className="glass rounded-2xl p-4 shadow-card space-y-3">
          <p className="text-sm font-medium text-foreground text-center">Sign out of Ingredia?</p>
          <div className="flex gap-2">
            <button onClick={handleLogout} className="flex-1 bg-danger text-white rounded-xl py-2.5 text-sm font-semibold">Sign Out</button>
            <button onClick={() => setConfirmLogout(false)} className="flex-1 glass rounded-xl py-2.5 text-sm font-semibold">Cancel</button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground pt-4">Ingredia · v1.0.0</p>
    </div>
  );
};

export default SettingsPage;
