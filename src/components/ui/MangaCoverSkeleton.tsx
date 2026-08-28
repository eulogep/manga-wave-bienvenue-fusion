interface MangaCoverSkeletonProps {
  className?: string;
  count?: number;
  cols?: string;
}

/** Shimmer cover placeholder shown while manga covers are loading */
const MangaCoverSkeleton = ({ count = 6, cols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' }: MangaCoverSkeletonProps) => (
  <div className={`grid ${cols} gap-4`} aria-hidden="true" aria-label="Chargement des couvertures">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-xl overflow-hidden">
        {/* Cover area */}
        <div className="aspect-[3/4] cover-skeleton rounded-t-xl" />
        {/* Info strip */}
        <div className="bg-wave-card px-3 py-2 rounded-b-xl space-y-2">
          <div className="skeleton h-3 w-4/5 rounded" />
          <div className="skeleton h-2.5 w-2/5 rounded" />
        </div>
      </div>
    ))}
  </div>
);

export default MangaCoverSkeleton;
