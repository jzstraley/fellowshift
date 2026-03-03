// src/components/DashboardSkeleton.jsx
// Pulsing placeholder that mirrors the DashboardView layout.
// Shown as the Suspense fallback while DashboardView lazy-loads.

const Shimmer = ({ className }) => (
  <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />
);

export default function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Top stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <Shimmer className="h-3 w-20 mb-2" />
            <Shimmer className="h-7 w-10" />
          </div>
        ))}
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, col) => (
          <div key={col} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <Shimmer className="h-4 w-28 mb-1" />
            {[...Array(4)].map((_, row) => (
              <div key={row} className="flex items-center gap-3">
                <Shimmer className="h-9 w-9 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Shimmer className="h-3 w-3/4" />
                  <Shimmer className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Wide card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <Shimmer className="h-4 w-32 mb-1" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Shimmer className="h-8 w-12 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Shimmer className="h-3 w-1/2" />
              <Shimmer className="h-2.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
