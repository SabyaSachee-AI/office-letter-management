import { Skeleton } from "@/components/ui/skeleton";

type FullPageLoadingProps = {
  message?: string;
};

export function FullPageLoading({ message = "Loading…" }: FullPageLoadingProps) {
  return (
    <div
      className="bg-slate-50 flex min-h-screen flex-col items-center justify-center gap-4 px-4"
      aria-busy
      aria-live="polite"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-3">
        <Skeleton className="from-[#123f63]/20 h-10 w-48 rounded-md bg-gradient-to-r to-cyan-600/20" />
        <Skeleton className="h-4 w-32 rounded-md bg-slate-200/80" />
      </div>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
