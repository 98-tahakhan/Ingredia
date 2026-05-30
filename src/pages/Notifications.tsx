import { ArrowLeft, Bell, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNotifications, markAllRead, clearNotifications, type AppNotification } from "@/lib/notifications";

const typeIcons: Record<string, string> = {
    scan: "🔍",
    ocr: "📷",
    save: "💾",
    ai: "✨",
    info: "ℹ️",
};

const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const Notifications = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState<AppNotification[]>([]);

    useEffect(() => {
        setItems(getNotifications());
        markAllRead();
    }, []);

    const handleClear = () => {
        clearNotifications();
        setItems([]);
    };

    return (
        <div className="px-5 pt-4 pb-8 space-y-5">
            <div className="flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full glass grid place-items-center">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-lg font-semibold text-foreground">Notifications</h1>
                {items.length > 0 ? (
                    <button onClick={handleClear} className="h-10 w-10 rounded-full glass grid place-items-center">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                ) : <div className="w-10" />}
            </div>

            {items.length === 0 ? (
                <div className="glass rounded-3xl p-10 text-center space-y-3 shadow-card">
                    <div className="mx-auto h-16 w-16 rounded-full gradient-hero grid place-items-center shadow-glow">
                        <Bell className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <p className="font-semibold text-foreground">All caught up</p>
                    <p className="text-sm text-muted-foreground">No notifications yet. Scan a product to get started.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {items.map((n) => (
                        <div key={n.id} className={`glass rounded-2xl p-3 flex items-start gap-3 shadow-card ${!n.read ? "border-l-2 border-primary" : ""}`}>
                            <span className="text-lg mt-0.5">{typeIcons[n.type] || "ℹ️"}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground">{n.message}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{formatTime(n.timestamp)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Notifications;
