/**
 * Lightweight loading skeleton shown while lazy-loaded pages are loading.
 * Matches the app's visual style with shimmer animation.
 */
const PageSkeleton = () => (
    <div className="px-5 pt-6 pb-8 space-y-5 animate-pulse">
        {/* Header skeleton */}
        <div className="space-y-3">
            <div className="h-7 w-48 rounded-xl bg-muted" />
            <div className="h-4 w-32 rounded-lg bg-muted/70" />
        </div>
        {/* Card skeletons */}
        <div className="space-y-3">
            <div className="h-20 w-full rounded-2xl bg-muted/50" />
            <div className="h-20 w-full rounded-2xl bg-muted/50" />
            <div className="h-20 w-full rounded-2xl bg-muted/50" />
        </div>
        {/* Bottom skeleton */}
        <div className="h-12 w-full rounded-2xl bg-muted/40" />
    </div>
);

export default PageSkeleton;
