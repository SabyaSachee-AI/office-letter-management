"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { createLetter } from "@/lib/api/letters";
import type { DepartmentOut } from "@/types/user";

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,application/pdf,image/*";

type LetterReceiveFormProps = {
  departments: DepartmentOut[];
};

export function LetterReceiveForm({ departments }: LetterReceiveFormProps) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [departmentId, setDepartmentId] = useState<string>(
    departments[0] ? String(departments[0].id) : ""
  );
  const [priority, setPriority] = useState("normal");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Please choose a file (PDF, image, or Word document).");
      return;
    }
    const fd = new FormData();
    fd.append("subject", subject.trim());
    fd.append("received_from", receivedFrom.trim());
    fd.append("department_id", departmentId);
    fd.append("priority", priority);
    fd.append("file", file);
    setPending(true);
    try {
      const letter = await createLetter(fd);
      router.push(`/dashboard/letters/${letter.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Receive / register letter</CardTitle>
        <p className="text-muted-foreground text-sm">
          Upload a supporting document: PDF, common image formats, or Word
          (.doc / .docx).
        </p>
      </CardHeader>
      <form onSubmit={(e) => void onSubmit(e)}>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <FormField id="subject" label="Subject" error={null}>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              minLength={2}
            />
          </FormField>
          <FormField id="received_from" label="Received from" error={null}>
            <Input
              id="received_from"
              value={receivedFrom}
              onChange={(e) => setReceivedFrom(e.target.value)}
              required
              minLength={2}
            />
          </FormField>
          <div className="grid gap-2">
            <Label htmlFor="department_id">Department</Label>
            <select
              id="department_id"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              required
            >
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="file">Attachment</Label>
            <Input
              id="file"
              type="file"
              accept={ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            <p className="text-muted-foreground text-xs">
              Stored on the server under the letter record (path shown on the
              letter detail page).
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Create letter"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/letters")}
          >
            Cancel
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
