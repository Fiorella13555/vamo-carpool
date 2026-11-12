interface SkeletonProps {
  className?: string;
}

// Shimmer que respeta prefers-reduced-motion (ver tokens.css, se
// desactiva globalmente la animación en ese caso).
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-sm bg-bg-sunken ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}
