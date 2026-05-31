import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, Heart, History, Home, ScanLine, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getUnreadCount } from "@/lib/notifications";
import { useState, useEffect, useMemo } from "react";
import { SwipePager } from "./SwipePager";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/history", icon: History, label: "History" },
  { to: "/scan", icon: ScanLine, label: "Scan", center: true },
  { to: "/saved", icon: Heart, label: "Saved" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

// Paths that use the SwipePager (main tabs)
const SWIPE_PATHS = ["/", "/history", "/saved", "/settings"];

function getUserDisplayName(user: any): string {
  if (!user) return "User";
  const meta = user.user_metadata || {};
  const name = meta.full_name || meta.name || "";
  if (name) return name.split(" ")[0];
  const email = user.email || "";
  if (email) {
    const username = email.split("@")[0];
    return username.charAt(0).toUpperCase() + username.slice(1);
  }
  return "User";
}

function getUserInitial(user: any): string {
  const name = getUserDisplayName(user);
  return name.charAt(0).toUpperCase();
}

export const AppShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hideChrome = location.pathname === "/scan" || location.pathname.startsWith("/processing");
  const isSwipePage = SWIPE_PATHS.includes(location.pathname);

  const initial = useMemo(() => getUserInitial(user), [user]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setUnread(getUnreadCount());
  }, [location.pathname]);

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-background pb-28 shadow-soft">
      {!hideChrome && (
        <header className="sticky top-0 z-30 glass flex items-center justify-between px-5 py-3">
          {/* Left: Logo + Brand */}
          <div className="flex items-center gap-2.5">
            <img
              src="/branding/logo-icon.svg"
              alt="Ingredia"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="text-sm font-bold tracking-wide text-foreground">
              Ingredia
            </span>
          </div>

          {/* Right: Notification + Avatar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/notifications")}
              className="relative h-9 w-9 rounded-full glass grid place-items-center tap-highlight"
            >
              <Bell className="h-4.5 w-4.5 text-foreground" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-danger text-[8px] font-bold text-white grid place-items-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="h-9 w-9 rounded-full gradient-hero grid place-items-center text-primary-foreground text-xs font-semibold shadow-glow tap-highlight"
            >
              {initial}
            </button>
          </div>
        </header>
      )}

      {/* Main content: SwipePager for tabs, Outlet for other pages */}
      {isSwipePage ? (
        <SwipePager />
      ) : (
        <main key={location.pathname} className="page-transition">
          <Outlet />
        </main>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4 pb-4">
        <div className="glass relative flex items-end justify-between rounded-[2rem] px-3 py-2 shadow-soft">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (item.center) {
              return (
                <NavLink key={item.to} to={item.to} className="-mt-8 flex flex-col items-center tap-highlight">
                  <div className="grid h-16 w-16 place-items-center rounded-full gradient-hero shadow-glow ring-4 ring-background animate-float">
                    <Icon className="h-7 w-7 text-primary-foreground" strokeWidth={2.4} />
                  </div>
                </NavLink>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors tap-highlight",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110 drop-shadow-[0_2px_6px_hsl(var(--primary)/0.5)]")} strokeWidth={isActive ? 2.4 : 2} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
