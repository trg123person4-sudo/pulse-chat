import { cn } from '../../lib/utils.js';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-slate-200 dark:bg-slate-800', className)}
      {...props}
    />
  );
}

export function ConversationListSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg">
          <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1 min-w-0">
            <Skeleton className="h-3 w-3/4 rounded" />
            <Skeleton className="h-2 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 items-start">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <div className="space-y-1.5 flex-1 max-w-lg">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-2 w-12 rounded" />
            </div>
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-4/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ThreadSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="space-y-2 pt-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-2.5 items-start p-2">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-3/4 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
