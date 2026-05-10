/**
 * Normalize notification deep-links. Prefers backend `link_path` / `route_module`
 * so routing does not depend on notification title text.
 */

const MODULE_PATH = /^\/dashboard\/(approval|assignment|consultant|closure)\/(\d+)\/?$/;

function hrefForModule(module: string, letterId: number): string | null {
  switch (module.toLowerCase()) {
    case "approval":
      return `/dashboard/approval/${letterId}`;
    case "assignment":
      return `/dashboard/assignment/${letterId}`;
    case "consultant":
      return `/dashboard/consultant/${letterId}`;
    case "closure":
      return `/dashboard/closure/${letterId}`;
    default:
      return null;
  }
}

export type NotificationLinkMeta = {
  type: string;
  letterId: number | null;
  title?: string;
  /** Same as API `link_url` / stored `link_path` when already module-safe */
  linkUrl?: string | null;
  routeModule?: string | null;
  eventCode?: string | null;
};

export function normalizeNotificationLink(
  url: string | null,
  meta: NotificationLinkMeta
): string {
  const preferred = (meta.linkUrl ?? url)?.trim() || "";
  if (preferred.startsWith("/letters/")) {
    return `/dashboard${preferred}`;
  }
  if (MODULE_PATH.test(preferred)) {
    return preferred.replace(/\/$/, "") || preferred;
  }
  if (preferred.startsWith("/dashboard/") && !preferred.startsWith("/dashboard/letters/")) {
    return preferred;
  }

  const m = preferred.match(/^\/dashboard\/letters\/(\d+)\/?$/);
  const idFromUrl = m ? Number(m[1]) : null;
  const letterId = idFromUrl ?? meta.letterId;
  if (!letterId || letterId < 1) {
    return preferred.startsWith("/dashboard/") ? preferred : "/dashboard/notifications";
  }

  const rm = (meta.routeModule || "").trim();
  if (rm) {
    const built = hrefForModule(rm, letterId);
    if (built) return built;
  }

  const ec = (meta.eventCode || "").toLowerCase();
  if (ec === "letter.closed" || ec.startsWith("letter.closed")) {
    return `/dashboard/closure/${letterId}`;
  }
  if (ec === "letter.received") {
    return `/dashboard/approval/${letterId}`;
  }
  if (ec === "consultant.resolved") {
    return `/dashboard/assignment/${letterId}`;
  }
  if (ec === "letter.routed" || ec === "letter.department_assigned") {
    return `/dashboard/assignment/${letterId}`;
  }
  if (ec.startsWith("assignment.")) {
    return `/dashboard/assignment/${letterId}`;
  }

  const t = (meta.type || "").toLowerCase();
  const title = (meta.title || "").toLowerCase();

  if (t === "assignment" || t === "reassignment") {
    return `/dashboard/assignment/${letterId}`;
  }
  if (t === "letter_closed") {
    return `/dashboard/closure/${letterId}`;
  }
  if (t === "system") {
    if (title.includes("new received letter")) {
      return `/dashboard/approval/${letterId}`;
    }
    if (title.includes("letter routed") || title.includes("routed:") || title.includes("department assigned")) {
      return `/dashboard/assignment/${letterId}`;
    }
    if (title.includes("consultant resolved")) {
      return `/dashboard/assignment/${letterId}`;
    }
  }

  return `/dashboard/letters/${letterId}`;
}
