"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ErrorBanner } from "@/components/data/error-banner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fetchLetterAttachmentBlob } from "@/lib/api/letters";
import { getApiErrorMessage } from "@/lib/api/error-message";

type ViewerMode = "fitWidth" | "fitPage";

type LetterAttachmentPreviewPaneProps = {
  letterId: number;
  pdfPath: string;
  className?: string;
};

export function LetterAttachmentPreviewPane({
  letterId,
  pdfPath,
  className,
}: LetterAttachmentPreviewPaneProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewerMode, setViewerMode] = useState<ViewerMode>("fitWidth");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setPreviewError(null);
    try {
      const blob = await fetchLetterAttachmentBlob(letterId);
      const url = URL.createObjectURL(blob);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      setPreviewError(getApiErrorMessage(e));
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } finally {
      setLoading(false);
    }
  }, [letterId]);

  useEffect(() => {
    void load();
    return () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [load]);

  const fileName = useMemo(() => pdfPath.split(/[\\/]/).pop() ?? "attachment", [pdfPath]);
  const lowerName = (fileName || "").toLowerCase();
  const isImage = [".png", ".jpg", ".jpeg", ".gif", ".webp"].some((ext) => lowerName.endsWith(ext));
  const isPdf = lowerName.endsWith(".pdf");

  return (
    <TooltipProvider delay={300}>
      <section
        className={cn(
          "flex min-h-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 shadow-sm sm:p-4",
          className
        )}
      >
        <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h3 className="text-xs font-semibold tracking-wide text-[#123f63] uppercase sm:text-sm sm:normal-case sm:tracking-normal">
          Attachment preview
        </h3>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
            >
              Zoom out
            </Button>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.1) * 10) / 10))}
            >
              Zoom in
            </Button>
            <Button
              size="sm"
              type="button"
              variant={viewerMode === "fitWidth" ? "secondary" : "outline"}
              onClick={() => setViewerMode("fitWidth")}
            >
              Fit width
            </Button>
            <Button
              size="sm"
              type="button"
              variant={viewerMode === "fitPage" ? "secondary" : "outline"}
              onClick={() => setViewerMode("fitPage")}
            >
              Fit page
            </Button>
            {blobUrl ? (
              <>
                <a
                  href={blobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                >
                  Open in new tab
                </a>
                <a
                  href={blobUrl}
                  download={fileName}
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                >
                  Download
                </a>
              </>
            ) : null}
            <Tooltip>
              <TooltipTrigger className="inline-flex cursor-default">
                <span className="inline-flex">
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    disabled
                    className="pointer-events-none text-slate-500"
                  >
                    Save
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-center">
                Annotation save will be available in a future update. The original file is never
                modified; future marks will be stored as overlay data only.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <p className="text-muted-foreground flex-shrink-0 font-mono text-[11px] break-all">
          {fileName}
        </p>

        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-inner",
            "min-h-[min(82vh,920px)] lg:min-h-[min(88vh,960px)]",
            viewerMode === "fitPage" ? "flex items-start justify-center" : ""
          )}
        >
          {loading ? (
            <p className="text-muted-foreground p-4 text-sm">Loading attachment…</p>
          ) : null}
          {!loading && !previewError && !blobUrl ? (
            <p className="p-4 text-sm text-slate-600">No attachment available for preview.</p>
          ) : null}
          {previewError ? (
            <div className="p-2">
              <ErrorBanner message={previewError} />
              <p className="text-muted-foreground mt-2 text-xs">
                Try Open in new tab or Download if the preview cannot load in the browser.
              </p>
            </div>
          ) : null}
          {blobUrl && isPdf ? (
            <iframe
              title="Letter attachment PDF preview"
              src={blobUrl}
              className={cn(
                "origin-top-left rounded-lg border border-slate-100",
                viewerMode === "fitPage"
                  ? "h-[min(88vh,1200px)] w-full max-w-5xl"
                  : "min-h-[min(75vh,640px)] w-full lg:min-h-[min(82vh,720px)]"
              )}
              style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
            />
          ) : null}
          {blobUrl && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blobUrl}
              alt="Letter attachment"
              className={cn(
                "rounded",
                viewerMode === "fitPage"
                  ? "mx-auto max-h-[min(88vh,920px)] w-auto max-w-full"
                  : "h-auto w-full"
              )}
              style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
            />
          ) : null}
          {blobUrl && !isPdf && !isImage ? (
            <p className="p-4 text-sm text-slate-600">
              This file type cannot be previewed inline. Use Open in new tab or Download to review
              the document.
            </p>
          ) : null}
        </div>
      </section>
    </TooltipProvider>
  );
}
