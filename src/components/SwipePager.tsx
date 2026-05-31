import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, useAnimation } from "framer-motion";
import PageSkeleton from "./PageSkeleton";

// ─── Lazy-loaded tab pages ───────────────────────────────────────────────────
const Index = lazy(() => import("@/pages/Index"));
const HistoryPage = lazy(() => import("@/pages/History"));
const Saved = lazy(() => import("@/pages/Saved"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

const TABS = [
    { path: "/", component: Index },
    { path: "/history", component: HistoryPage },
    { path: "/saved", component: Saved },
    { path: "/settings", component: SettingsPage },
];

const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 0.3; // px/ms
const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

export const SwipePager = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const controls = useAnimation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    // Track active tab
    const currentIndex = TABS.findIndex((t) => t.path === location.pathname);
    const activeIndex = currentIndex >= 0 ? currentIndex : 0;
    const indexRef = useRef(activeIndex);
    indexRef.current = activeIndex;

    // Touch state (refs to avoid re-renders during gesture)
    const startX = useRef(0);
    const startY = useRef(0);
    const startTime = useRef(0);
    const dragging = useRef(false);
    const axisLock = useRef<"x" | "y" | null>(null);
    const offset = useRef(0);
    const widthRef = useRef(width);
    widthRef.current = width;

    // Measure container width
    useEffect(() => {
        const measure = () => {
            if (containerRef.current) {
                setWidth(containerRef.current.offsetWidth);
            }
        };
        measure();
        const t = setTimeout(measure, 50);
        window.addEventListener("resize", measure);
        return () => {
            clearTimeout(t);
            window.removeEventListener("resize", measure);
        };
    }, []);

    // Snap to active tab on route change (navbar tap)
    useEffect(() => {
        if (width > 0) {
            controls.start({ x: -activeIndex * width, transition: SPRING });
        }
    }, [activeIndex, width, controls]);

    // ─── Native touch event listeners (non-passive for preventDefault) ─────────
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            startX.current = touch.clientX;
            startY.current = touch.clientY;
            startTime.current = Date.now();
            dragging.current = false;
            axisLock.current = null;
            offset.current = 0;
        };

        const onTouchMove = (e: TouchEvent) => {
            const w = widthRef.current;
            if (w === 0) return;

            const touch = e.touches[0];
            const dx = touch.clientX - startX.current;
            const dy = touch.clientY - startY.current;

            // Determine axis on first significant movement
            if (!axisLock.current) {
                if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
                axisLock.current = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
            }

            // Vertical → let native scroll handle it
            if (axisLock.current === "y") return;

            // Horizontal → we handle it, prevent scroll
            e.preventDefault();
            dragging.current = true;

            // Rubber band at edges
            let d = dx;
            const idx = indexRef.current;
            if ((idx === 0 && dx > 0) || (idx === TABS.length - 1 && dx < 0)) {
                d = dx * 0.15;
            }

            offset.current = d;
            controls.set({ x: -idx * w + d });
        };

        const onTouchEnd = () => {
            if (!dragging.current || axisLock.current !== "x") {
                dragging.current = false;
                axisLock.current = null;
                return;
            }

            const w = widthRef.current;
            const dx = offset.current;
            const dt = Date.now() - startTime.current || 1;
            const velocity = Math.abs(dx) / dt;

            let newIndex = indexRef.current;

            if (dx < -SWIPE_THRESHOLD || (dx < -15 && velocity > VELOCITY_THRESHOLD)) {
                newIndex = Math.min(indexRef.current + 1, TABS.length - 1);
            } else if (dx > SWIPE_THRESHOLD || (dx > 15 && velocity > VELOCITY_THRESHOLD)) {
                newIndex = Math.max(indexRef.current - 1, 0);
            }

            controls.start({ x: -newIndex * w, transition: SPRING });

            if (newIndex !== indexRef.current) {
                navigate(TABS[newIndex].path, { replace: true });
            }

            dragging.current = false;
            axisLock.current = null;
            offset.current = 0;
        };

        // Attach with { passive: false } so preventDefault works on mobile
        el.addEventListener("touchstart", onTouchStart, { passive: true });
        el.addEventListener("touchmove", onTouchMove, { passive: false });
        el.addEventListener("touchend", onTouchEnd, { passive: true });

        return () => {
            el.removeEventListener("touchstart", onTouchStart);
            el.removeEventListener("touchmove", onTouchMove);
            el.removeEventListener("touchend", onTouchEnd);
        };
    }, [controls, navigate]);

    return (
        <div
            ref={containerRef}
            style={{
                overflow: "hidden",
                height: "calc(100vh - 180px)",
                position: "relative",
            }}
        >
            <motion.div
                animate={controls}
                style={{
                    display: "flex",
                    width: `${TABS.length * 100}%`,
                    height: "100%",
                    willChange: "transform",
                }}
            >
                {TABS.map((tab) => {
                    const TabComponent = tab.component;
                    return (
                        <div
                            key={tab.path}
                            style={{
                                width: `${100 / TABS.length}%`,
                                height: "100%",
                                flexShrink: 0,
                                overflowY: "auto",
                                overflowX: "hidden",
                                WebkitOverflowScrolling: "touch",
                            }}
                        >
                            <Suspense fallback={<PageSkeleton />}>
                                <TabComponent />
                            </Suspense>
                        </div>
                    );
                })}
            </motion.div>
        </div>
    );
};
