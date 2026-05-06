import { redirect } from "next/navigation";

export default async function ApprovalReviewRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const letterId = Number(id);
  if (!Number.isFinite(letterId)) {
    return <p className="text-sm text-red-600">Invalid letter ID.</p>;
  }
  redirect(`/dashboard/letters/${letterId}`);
}
