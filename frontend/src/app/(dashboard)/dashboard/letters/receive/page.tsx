"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { LetterReceiveForm } from "@/components/letters/letter-receive-form";
import { fetchDepartments } from "@/lib/api/users";
import type { DepartmentOut } from "@/types/user";

export default function ReceiveLetterPage() {
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);

  useEffect(() => {
    void fetchDepartments().then(setDepartments);
  }, []);

  if (!departments.length) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receive letter"
        description="Register an incoming letter with an attachment (PDF, image, or Word)."
      />
      <LetterReceiveForm departments={departments} />
    </div>
  );
}
