"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { canAccessPath } from "@/lib/auth/screen-access";

export function ScreenGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { user } = useAuth();
  const screens = user?.allowed_screens ?? [];

  if (!canAccessPath(pathname, screens)) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Access denied</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            You do not have permission to open this page. If you believe this is a mistake,
            contact a system administrator.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "default" }))}>
            Back to overview
          </Link>
          <Link href="/dashboard/access-denied" className={cn(buttonVariants({ variant: "outline" }))}>
            Details
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
