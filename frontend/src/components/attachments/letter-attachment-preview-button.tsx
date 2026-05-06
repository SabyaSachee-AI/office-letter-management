"use client";

import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import type { ComponentProps } from "react";

import { FilePreviewDialog } from "@/components/attachments/file-preview-dialog";
import { Button } from "@/components/ui/button";
import {
  basenamePath,
  previewKindFromMime,
  type PreviewKind,
} from "@/lib/attachments";
import { getApiErrorMessageAsync } from "@/lib/api/error-message";
import { fetchLetterAttachmentBlob } from "@/lib/api/letters";

type LetterAttachmentPreviewButtonProps = {
  letterId: number;
  filePathHint: string;
  label?: string;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
};

export function LetterAttachmentPreviewButton({
  letterId,
  filePathHint,
  label = "View",
  size = "sm",
  variant = "outline",
  className,
}: LetterAttachmentPreviewButtonProps) {
  const [open, setOpen] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<PreviewKind>("unknown");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = basenamePath(filePathHint);

  useEffect(() => {
    if (!open) {
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
      setLoading(false);
      setKind("unknown");
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const blob = await fetchLetterAttachmentBlob(letterId);
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
        setKind(previewKindFromMime(blob.type || "", displayName));
      } catch (e) {
        if (!cancelled) {
          setError(await getApiErrorMessageAsync(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, letterId, displayName]);

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
        title={label.trim() ? label : "View attachment"}
      >
        <Eye className="size-4" />
        {label.trim() ? <span className="ml-1">{label}</span> : null}
        {!label.trim() ? (
          <span className="sr-only">View attachment</span>
        ) : null}
      </Button>
      <FilePreviewDialog
        open={open}
        onOpenChange={setOpen}
        title="Attachment preview"
        fileName={displayName}
        objectUrl={objectUrl}
        kind={kind}
        loading={loading}
        error={error}
      />
    </>
  );
}
