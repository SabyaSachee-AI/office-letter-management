import { PageHeader } from "@/components/layout/page-header";

export default function SecurityLogsPlaceholderPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Security logs"
        description="Admins: audit logs /api/v1/activity/audit-logs and login logs /api/v1/activity/login-logs."
      />
    </div>
  );
}
