export type PreviewKind = "pdf" | "image" | "office" | "unknown";

export function basenamePath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function previewKindFromFileName(name: string): PreviewKind {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp)$/i.test(n)) return "image";
  if (/\.(doc|docx)$/i.test(n)) return "office";
  return "unknown";
}

export function previewKindFromMime(mime: string, fileName: string): PreviewKind {
  const m = mime.toLowerCase();
  if (m === "application/pdf" || m.includes("pdf")) return "pdf";
  if (m.startsWith("image/")) return "image";
  if (
    m.includes("wordprocessingml") ||
    m.includes("msword") ||
    /\.(doc|docx)$/i.test(fileName)
  ) {
    return "office";
  }
  return previewKindFromFileName(fileName);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
