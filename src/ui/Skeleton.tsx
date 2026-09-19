export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div
    className={`skeleton-shimmer rounded-[var(--radius-field)] ${className}`}
  />
);

export const SkeletonRows = ({ count = 4 }: { count?: number }) => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="flex items-center gap-4 rounded-[var(--radius-card)] border border-[var(--line)] p-4"
      >
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
    ))}
  </div>
);
