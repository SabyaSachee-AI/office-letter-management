import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LetterActionHistoryItem } from "@/types/letter";

export function ActionHistoryList({
  actions,
}: {
  actions: LetterActionHistoryItem[];
}) {
  if (!actions.length) {
    return (
      <p className="text-muted-foreground text-sm">No actions recorded yet.</p>
    );
  }
  const sorted = [...actions].sort((a, b) => a.id - b.id);
  return (
    <ul className="space-y-3">
      {sorted.map((a) => (
        <li
          key={a.id}
          className="border-muted relative border-l-2 pl-4 text-sm"
        >
          <div className="text-muted-foreground mb-0.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-foreground font-mono">{a.action}</span>
            <span>·</span>
            <time dateTime={a.created_at}>
              {new Date(a.created_at).toLocaleString()}
            </time>
            {a.acted_by_full_name ? (
              <>
                <span>·</span>
                <span>{a.acted_by_full_name}</span>
              </>
            ) : null}
          </div>
          <p className="whitespace-pre-wrap">{a.comment}</p>
        </li>
      ))}
    </ul>
  );
}

export function ActionHistoryCard({
  title = "Action history",
  actions,
}: {
  title?: string;
  actions: LetterActionHistoryItem[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ActionHistoryList actions={actions} />
      </CardContent>
    </Card>
  );
}
