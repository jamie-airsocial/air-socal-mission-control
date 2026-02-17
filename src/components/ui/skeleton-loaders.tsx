import { Skeleton } from '@/components/ui/skeleton';

/* ================================================================== */
/* Board Page Skeletons                                               */
/* ================================================================== */

export function KanbanBoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-x-visible md:pb-0">
      {[1, 2, 3, 4].map((col) => (
        <div key={col} className="p-1 min-w-[260px] md:min-w-0">
          <div className="mb-3 flex items-center gap-2 px-1">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-6" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((task) => (
              <div
                key={task}
                className="rounded-lg border border-border/20/20 bg-card p-3 space-y-2"
              >
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableViewSkeleton() {
  return (
    <div className="rounded-lg border border-border/20/20 bg-card">
      <div className="divide-y divide-border/50">
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="flex items-center gap-4 p-4">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Board Calendar View Skeleton (board page, calendar view)          */
/* ================================================================== */

export function CalendarViewSkeleton() {
  return (
    <div className="bg-card rounded-lg border border-border/20 p-4 animate-pulse">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-14 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-md" />
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-px bg-border/10 border border-border/20 rounded-t-lg overflow-hidden mb-px">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="bg-card px-2 py-1.5 text-center">
            <Skeleton className="h-3 w-6 mx-auto" />
          </div>
        ))}
      </div>

      {/* Calendar grid — 5 rows × 7 cols */}
      <div className="grid grid-cols-7 gap-px bg-border/10 border border-border/20 rounded-b-lg overflow-hidden">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="bg-card p-1.5 min-h-[90px]">
            <Skeleton className="h-3 w-5 mb-2" />
            {i % 5 === 0 && <Skeleton className="h-4 w-full rounded mb-0.5" />}
            {i % 7 === 2 && <Skeleton className="h-4 w-5/6 rounded mb-0.5" />}
            {i % 4 === 1 && <Skeleton className="h-4 w-4/5 rounded" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Calendar Page Skeleton                                             */
/* ================================================================== */

export function CalendarSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <div
              key={day}
              className="flex min-h-[120px] flex-col rounded-xl border border-border/20 bg-card p-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <Skeleton className="h-3 w-12 mb-1" />
                  <Skeleton className="h-6 w-8" />
                </div>
                <Skeleton className="h-3 w-8" />
              </div>
              <div className="mt-3 space-y-1.5">
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <aside className="space-y-4">
        <div className="rounded-xl border border-border/20 bg-card p-4">
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-7 rounded" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/20 bg-card p-4">
          <Skeleton className="h-4 w-40 mb-3" />
          <div className="space-y-2">
            {[1, 2, 3].map((task) => (
              <div key={task} className="space-y-2 p-3 rounded-lg border border-border/20">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ================================================================== */
/* Documents Page Skeleton                                            */
/* ================================================================== */

export function DocumentsPageSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
      {/* File tree skeleton */}
      <aside className="space-y-2">
        <Skeleton className="h-4 w-32 mb-3" />
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="space-y-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-full" />
            </div>
            {item % 2 === 0 && (
              <div className="ml-6 space-y-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            )}
          </div>
        ))}
      </aside>

      {/* Document preview skeleton */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="rounded-lg border border-border/20/20 bg-card p-6 space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="pt-4">
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Goals Page Skeleton                                                */
/* ================================================================== */

export function GoalsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((stat) => (
          <div key={stat} className="rounded-lg border border-border/20/20 bg-card p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Goals grid */}
      <div className="space-y-4">
        {[1, 2, 3].map((goal) => (
          <div
            key={goal}
            className="rounded-lg border border-border/20/20 bg-card p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Changelog Page Skeleton                                            */
/* ================================================================== */

export function ChangelogSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3, 4].map((entry) => (
        <div
          key={entry}
          className="rounded-lg border border-border/20/20 bg-card p-6 space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/* Dashboard Skeleton                                                 */
/* ================================================================== */

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((stat) => (
          <div key={stat} className="rounded-lg border border-border/20/20 bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-24 mt-1" />
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tasks widget */}
        <div className="rounded-lg border border-border/20/20 bg-card p-4 space-y-3">
          <Skeleton className="h-5 w-32 mb-3" />
          {[1, 2, 3, 4].map((task) => (
            <div key={task} className="flex items-center gap-3 p-3 rounded-md border border-border/20">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>

        {/* Activity widget */}
        <div className="rounded-lg border border-border/20/20 bg-card p-4 space-y-3">
          <Skeleton className="h-5 w-32 mb-3" />
          {[1, 2, 3, 4].map((activity) => (
            <div key={activity} className="flex items-start gap-3 p-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Agents Page Skeleton                                               */
/* ================================================================== */

export function AgentsPageSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((agent) => (
        <div
          key={agent}
          className="rounded-lg border border-border/20/20 bg-card p-4 space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
