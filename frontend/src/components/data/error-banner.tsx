import { cn } from "@/lib/utils";

type ErrorBannerProps = {
  message: string;
  className?: string;
};

export function ErrorBanner({ message, className }: ErrorBannerProps) {
  return (
    <p
      className={cn("text-destructive text-sm", className)}
      role="alert"
    >
      {message}
    </p>
  );
}
