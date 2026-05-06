"use client";

import { Download, Loader2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PreviewKind } from "@/lib/attachments";
import { cn } from "@/lib/utils";

export type FilePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fileName: string;
  objectUrl: string | null;
  kind: PreviewKind;
  loading?: boolean;
  error?: string | null;
};

export function FilePreviewDialog({
  open,
  onOpenChange,
  title,
  fileName,
  objectUrl,
  kind,
  loading,
  error,
}: FilePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "flex max-h-[min(90vh,900px)] w-[min(96vw,56rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,56rem)]"
        )}
      >
        <DialogHeader className="border-border shrink-0 space-y-1 border-b px-4 py-3 text-left">
          <DialogTitle className="pr-8">{title}</DialogTitle>
          <DialogDescription className="truncate font-mono text-xs">
            {fileName}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 relative min-h-[200px] flex-1 overflow-auto">
          {loading ? (
            <div className="text-muted-foreground flex min-h-[240px] flex-col items-center justify-center gap-2 p-8">
              <Loader2 className="size-8 animate-spin opacity-70" />
              <span className="text-sm">Loading preview…</span>
            </div>
          ) : error ? (
            <p className="text-destructive p-6 text-sm" role="alert">
              {error}
            </p>
          ) : !objectUrl ? (
            <p className="text-muted-foreground p-6 text-sm">No file to preview.</p>
          ) : kind === "pdf" ? (
            <iframe
              title={fileName}
              src={objectUrl}
              className="h-[min(75vh,720px)] w-full min-h-[320px] border-0 bg-white"
            />
          ) : kind === "image" ? (
            <div className="flex justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={objectUrl}
                alt={fileName}
                className="max-h-[min(75vh,720px)] w-auto max-w-full object-contain"
              />
            </div>
          ) : kind === "office" ? (
            <div className="space-y-4 p-6">
              <p className="text-muted-foreground text-sm">
                Word documents cannot be previewed in the browser. Download the
                file to open it on your device.
              </p>
              <a
                href={objectUrl}
                download={fileName}
                className={cn(buttonVariants({ variant: "default", size: "default" }), "inline-flex gap-2")}
              >
                <Download className="size-4" />
                Download
              </a>
            </div>
          ) : (
            <div className="space-y-4 p-6">
              <p className="text-muted-foreground text-sm">
                Preview is not available for this file type. You can download it
                instead.
              </p>
              <a
                href={objectUrl}
                download={fileName}
                className={cn(buttonVariants({ variant: "outline", size: "default" }), "inline-flex gap-2")}
              >
                <Download className="size-4" />
                Download
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
