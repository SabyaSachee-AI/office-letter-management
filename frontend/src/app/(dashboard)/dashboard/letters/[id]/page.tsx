"use client";

import { useParams } from "next/navigation";

import { LetterDetailView } from "@/components/letters/letter-detail-view";

export default function LetterDetailPage() {
  const params = useParams();
  const raw = params?.id;
  const id = typeof raw === "string" ? Number(raw) : NaN;

  if (!Number.isFinite(id) || id < 1) {
    return <p className="text-destructive text-sm">Invalid letter id.</p>;
  }

  return <LetterDetailView letterId={id} />;
}
