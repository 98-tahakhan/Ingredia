import { useEffect, useState } from "react";

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
    const [visible, setVisible] = useState(true);
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setFadeOut(true);
            setTimeout(() => {
                setVisible(false);
                onComplete();
            }, 500);
        }, 2000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    if (!visible) return null;

    return (
        <div
            className={`fixed inset-0 z-[9999] bg-[#0a1a0f] flex flex-col items-center justify-center transition-opacity duration-500 ${fadeOut ? "opacity-0" : "opacity-100"}`}
        >
            {/* Logo Icon */}
            <div className="animate-fade-in">
                <svg width="80" height="80" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="25" y="60" width="6" height="40" rx="1.5" fill="#15803D" />
                    <rect x="35" y="52" width="6" height="48" rx="1.5" fill="#15803D" />
                    <rect x="45" y="44" width="6" height="56" rx="1.5" fill="#16A34A" />
                    <rect x="55" y="36" width="6" height="64" rx="1.5" fill="#22C55E" />
                    <rect x="65" y="42" width="6" height="58" rx="1.5" fill="#22C55E" />
                    <rect x="75" y="52" width="6" height="48" rx="1.5" fill="#16A34A" />
                    <rect x="85" y="60" width="6" height="40" rx="1.5" fill="#15803D" />
                    <line x1="38" y1="48" x2="38" y2="32" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="38" cy="28" r="4" fill="#22C55E" />
                    <line x1="55" y1="32" x2="55" y2="18" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="55" cy="14" r="4" fill="#22C55E" />
                    <line x1="55" y1="14" x2="65" y2="8" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="68" cy="6" r="3" fill="#86EFAC" />
                    <line x1="38" y1="28" x2="28" y2="22" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="25" cy="20" r="3" fill="#86EFAC" />
                    <path d="M68 38 C78 18, 100 10, 108 7 C105 18, 95 32, 78 44 C90 28, 100 18, 105 12 C95 18, 82 30, 73 42 Z" fill="url(#splashLeaf)" />
                    <path d="M73 40 C83 28, 95 18, 104 11" stroke="#15803D" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                    <defs>
                        <linearGradient id="splashLeaf" x1="68" y1="44" x2="108" y2="7" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#22C55E" />
                            <stop offset="100%" stopColor="#86EFAC" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>

            {/* Brand Name */}
            <h1 className="mt-6 text-2xl font-bold tracking-[0.3em] text-[#22C55E]">
                INGREDIA
            </h1>

            {/* Tagline */}
            <p className="mt-2 text-sm italic text-[#86EFAC]/80">
                See Beyond the Label.
            </p>

            {/* Sub-tagline */}
            <p className="mt-4 text-xs text-white/40 tracking-wider">
                Scan · Understand · Choose Better
            </p>

            {/* Loading indicator */}
            <div className="mt-8 flex gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" style={{ animationDelay: "200ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" style={{ animationDelay: "400ms" }} />
            </div>
        </div>
    );
};

export default SplashScreen;
