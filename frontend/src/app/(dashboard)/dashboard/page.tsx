"use client";

import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/context/auth-context";

export default function DashboardHomePage() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={`Welcome back, ${user?.full_name ?? "officer"}. Use the sidebar to open letters, workflows, notifications, and administrative tools. Available routes reflect your roles from the system.`}
      />
      <div className="bg-card rounded-xl border p-5 shadow-sm ring-1 ring-black/[0.04]">
        <p className="text-muted-foreground text-sm leading-relaxed">
          This dashboard follows enterprise workflow conventions: structured
          approvals, assignment queues, and audit-friendly records suitable for
          office and government correspondence management.
        </p>
      </div>
    </div>
  );
}
