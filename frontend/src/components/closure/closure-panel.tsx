"use client";

import { useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api/error-message";
import {
  addFinalComment,
  closeIssue,
  reviewSolution,
} from "@/lib/api/closure";

type ClosurePanelProps = {
  letterId: number;
  onChanged: () => void;
};

export function ClosurePanel({ letterId, onChanged }: ClosurePanelProps) {
  const [review, setReview] = useState("");
  const [finalC, setFinalC] = useState("");
  const [closeC, setCloseC] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(
    key: string,
    fn: () => Promise<unknown>,
    reset: () => void
  ) {
    setErr(null);
    setMsg(null);
    setBusy(key);
    try {
      await fn();
      reset();
      setMsg("Saved.");
      onChanged();
    } catch (e) {
      setErr(getApiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card id="closure">
      <CardHeader>
        <CardTitle className="text-base">Closure workflow</CardTitle>
        <p className="text-muted-foreground text-sm">
          Review consultant evidence, add final remarks, then formally close the
          issue (requires prior solution review).
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {err ? (
          <p className="text-destructive text-sm" role="alert">
            {err}
          </p>
        ) : null}
        {msg ? (
          <p className="text-emerald-700 text-sm dark:text-emerald-400">{msg}</p>
        ) : null}

        <div className="space-y-2">
          <h4 className="text-sm font-medium">1. Review solution</h4>
          <FormField id="review_comment" label="Review comment" error={null}>
            <textarea
              id="review_comment"
              className="border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              minLength={3}
            />
          </FormField>
          <Button
            type="button"
            size="sm"
            disabled={busy !== null || review.trim().length < 3}
            onClick={() =>
              void run("review", () => reviewSolution(letterId, review.trim()), () =>
                setReview("")
              )
            }
          >
            {busy === "review" ? "Saving…" : "Submit review"}
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">2. Final comment (optional step)</h4>
          <FormField id="final_comment" label="Comment" error={null}>
            <textarea
              id="final_comment"
              className="border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
              value={finalC}
              onChange={(e) => setFinalC(e.target.value)}
              minLength={3}
            />
          </FormField>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy !== null || finalC.trim().length < 3}
            onClick={() =>
              void run("final", () => addFinalComment(letterId, finalC.trim()), () =>
                setFinalC("")
              )
            }
          >
            {busy === "final" ? "Saving…" : "Add final comment"}
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">3. Close issue</h4>
          <FormField id="close_comment" label="Final closure comment" error={null}>
            <textarea
              id="close_comment"
              className="border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
              value={closeC}
              onChange={(e) => setCloseC(e.target.value)}
              minLength={3}
            />
          </FormField>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy !== null || closeC.trim().length < 3}
            onClick={() =>
              void run("close", () => closeIssue(letterId, closeC.trim()), () =>
                setCloseC("")
              )
            }
          >
            {busy === "close" ? "Closing…" : "Close issue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
