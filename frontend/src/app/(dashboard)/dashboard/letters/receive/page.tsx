"use client";

import { isAxiosError } from "axios";
import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/data/error-banner";
import { PageHeader } from "@/components/layout/page-header";
import { LetterReceiveForm } from "@/components/letters/letter-receive-form";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { fetchDepartments } from "@/lib/api/users";
import type { DepartmentOut } from "@/types/user";

export default function ReceiveLetterPage() {
  const [departments, setDepartments] = useState<DepartmentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void fetchDepartments()
      .then((rows) => {
        if (!active) return;
        setDepartments(rows);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isAxiosError(err) && err.response?.status === 403) {
          setError(
            "You do not have access to department reference data. Contact an administrator."
          );
          return;
        }
        setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receive letter"
        description="Register an incoming letter with an attachment (PDF, image, or Word)."
      />
      {error ? <ErrorBanner message={error} /> : null}
      {!error && departments.length ? (
        <LetterReceiveForm departments={departments} />
      ) : null}
      {!error && !departments.length ? (
        <p className="text-muted-foreground text-sm">
          No departments are available yet. Please contact an administrator.
        </p>
      ) : null}
    </div>
  );
}
