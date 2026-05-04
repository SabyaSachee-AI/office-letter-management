import { PageHeader } from "@/components/layout/page-header";

export default function NotificationsPlaceholderPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Connect to GET /api/v1/activity/notifications and mark-read endpoints."
      />
    </div>
  );
}
