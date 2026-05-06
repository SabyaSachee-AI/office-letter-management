"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorBanner } from "@/components/data/error-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAdmin } from "@/lib/auth/roles";
import { createNotice, deleteNotice, getNotices, updateNotice } from "@/lib/api/notices";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { toastError, toastSuccess } from "@/lib/toast";
import type { NoticeOut } from "@/types/notice";
import type { UserOut } from "@/types/user";

type NoticeBoardProps = {
  user: UserOut | null;
};

type FormState = {
  title: string;
  message: string;
  expiresAt: string;
  isPinned: boolean;
  isActive: boolean;
};

const emptyForm: FormState = {
  title: "",
  message: "",
  expiresAt: "",
  isPinned: false,
  isActive: true,
};

function toInputDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 16);
}

export function NoticeBoard({ user }: NoticeBoardProps) {
  const canManage = isAdmin(user);
  const [items, setItems] = useState<NoticeOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<NoticeOut | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getNotices(50, 0);
      setItems(res.items);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const title = editing ? "Edit notice" : "Create notice";
  const submitLabel = editing ? "Update Notice" : "Create Notice";
  const boardItems = useMemo(() => items, [items]);

  function startEdit(n: NoticeOut) {
    setEditing(n);
    setForm({
      title: n.title,
      message: n.message,
      expiresAt: toInputDateTime(n.expires_at),
      isPinned: n.is_pinned,
      isActive: n.is_active,
    });
    setFormError(null);
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (form.title.trim().length < 2 || form.message.trim().length < 2) {
      const m = "Title and message must be at least 2 characters.";
      setFormError(m);
      toastError(m);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        is_pinned: form.isPinned,
        is_active: form.isActive,
      };
      if (editing) {
        await updateNotice(editing.id, payload);
        toastSuccess("Notice updated successfully.");
      } else {
        await createNotice(payload);
        toastSuccess("Notice created successfully.");
      }
      resetForm();
      await load();
    } catch (e) {
      const m = getApiErrorMessage(e);
      setFormError(m);
      toastError(m);
    } finally {
      setSaving(false);
    }
  }

  async function removeNotice(id: number) {
    if (!confirm("Delete this notice?")) return;
    try {
      await deleteNotice(id);
      await load();
      toastSuccess("Notice deleted successfully.");
    } catch (e) {
      const m = getApiErrorMessage(e);
      setError(m);
      toastError(m);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-[#c5d9ef] bg-[#f7fbff] p-4">
        <h2 className="text-lg font-semibold text-[#123f63]">Notice Board</h2>
        <p className="text-muted-foreground text-sm">
          Official announcements and updates for all users.
        </p>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {canManage ? (
        <Card className="border-[#d7e6f6]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#123f63]">{title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {formError ? <p className="text-destructive sm:col-span-2 text-sm">{formError}</p> : null}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="notice-title">Title</Label>
              <Input
                id="notice-title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="notice-message">Message</Label>
              <textarea
                id="notice-message"
                className="border-input bg-background min-h-28 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Write official notice details..."
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notice-expiry">Expiry date (optional)</Label>
              <Input
                id="notice-expiry"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
              />
            </div>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(e) => setForm((p) => ({ ...p, isPinned: e.target.checked }))}
                />
                Pin notice
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                Active
              </label>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button disabled={saving} onClick={() => void submit()}>
                {saving ? "Saving..." : submitLabel}
              </Button>
              {editing ? (
                <Button variant="outline" onClick={resetForm}>
                  Cancel Edit
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading ? <p className="text-muted-foreground text-sm">Loading notices...</p> : null}

      <div className="grid gap-3">
        {!loading && boardItems.length === 0 ? (
          <Card>
            <CardContent className="py-5 text-sm text-slate-600">No active notices right now.</CardContent>
          </Card>
        ) : null}
        {boardItems.map((n) => (
          <Card key={n.id} className="border-[#d8e5f3] shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base text-[#123f63]">
                  {n.title} {n.is_pinned ? <span className="text-xs text-[#1f6ca6]">PINNED</span> : null}
                </CardTitle>
                <span className="text-xs text-slate-500">
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{n.message}</p>
              {n.expires_at ? (
                <p className="text-xs text-slate-500">Expires: {new Date(n.expires_at).toLocaleString()}</p>
              ) : null}
              {canManage ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(n)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void removeNotice(n.id)}>
                    Delete
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
