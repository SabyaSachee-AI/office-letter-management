"use client";

import { useParams } from "next/navigation";

import { LetterDetailView } from "@/components/letters/letter-detail-view";

export default function ConsultantLetterPage() {
  const params = useParams();
  const raw = params?.id;
  const letterId = typeof raw === "string" ? Number(raw) : NaN;

  if (!Number.isFinite(letterId) || letterId < 1) {
    return <p className="text-sm text-red-600">Invalid letter ID.</p>;
  }

  return <LetterDetailView letterId={letterId} moduleContext="consultant" />;
}
