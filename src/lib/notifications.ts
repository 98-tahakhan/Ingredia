/**
 * Simple MVP notification system using localStorage.
 */

export interface AppNotification {
    id: string;
    message: string;
    type: "scan" | "ocr" | "save" | "ai" | "info";
    read: boolean;
    timestamp: string;
}

const STORAGE_KEY = "ingredia-notifications";

function getAll(): AppNotification[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function save(notifications: AppNotification[]) {
    // Keep only last 50 notifications
    const trimmed = notifications.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function getNotifications(): AppNotification[] {
    return getAll();
}

export function getUnreadCount(): number {
    return getAll().filter(n => !n.read).length;
}

export function addNotification(message: string, type: AppNotification["type"] = "info") {
    const notifications = getAll();
    notifications.unshift({
        id: crypto.randomUUID(),
        message,
        type,
        read: false,
        timestamp: new Date().toISOString(),
    });
    save(notifications);
}

export function markAllRead() {
    const notifications = getAll().map(n => ({ ...n, read: true }));
    save(notifications);
}

export function clearNotifications() {
    localStorage.removeItem(STORAGE_KEY);
}
