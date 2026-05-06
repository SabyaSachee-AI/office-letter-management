import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AccessDeniedPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">403 — Access denied</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Your account is signed in, but you are not allowed to use this part of the application.
        Screen access is controlled in Role Management (system administrators only).
      </p>
      <Link href="/dashboard" className={cn(buttonVariants({ variant: "default" }))}>
        Return to overview
      </Link>
    </div>
  );
}
