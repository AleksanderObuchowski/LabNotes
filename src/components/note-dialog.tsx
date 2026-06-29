"use client";

import { ArrowDown, ArrowRight, ArrowUp, CheckCircle2, CircleDashed } from "lucide-react";
import type { Note } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Markdown } from "@/components/markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export function NoteDialog({
  note,
  onOpenChange,
}: {
  note: Note | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!note} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {note ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                {note.experiment ? (
                  <Badge variant="outline" className="font-normal text-muted-foreground">
                    {note.experiment}
                  </Badge>
                ) : null}
                {note.verified ? (
                  <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                    <CheckCircle2 className="size-3" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <CircleDashed className="size-3" /> Unverified
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-xl leading-snug">{note.title}</DialogTitle>
            </DialogHeader>

            {note.text ? <Markdown>{note.text}</Markdown> : null}

            <Separator className="my-1" />
            <div>
              {note.metric ? (
                <Field label="Metric">
                  <span className="inline-flex items-center gap-2 font-mono text-xs">
                    {note.metric}
                    {note.delta != null ? (
                      <span
                        className={
                          note.delta > 0
                            ? "inline-flex items-center gap-0.5 text-emerald-500"
                            : note.delta < 0
                              ? "inline-flex items-center gap-0.5 text-red-500"
                              : "inline-flex items-center gap-0.5 text-muted-foreground"
                        }
                      >
                        {note.delta > 0 ? <ArrowUp className="size-3" /> : note.delta < 0 ? <ArrowDown className="size-3" /> : <ArrowRight className="size-3" />}
                        {note.delta > 0 ? "+" : ""}{note.delta}
                      </span>
                    ) : null}
                    {note.value != null ? <span className="text-muted-foreground">= {note.value}</span> : null}
                  </span>
                </Field>
              ) : null}
              {note.tags.length ? (
                <Field label="Tags">
                  <span className="flex flex-wrap justify-end gap-1">
                    {note.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </span>
                </Field>
              ) : null}
              <Field label="Author">@{note.author_login}</Field>
              <Field label="Date">{new Date(note.created_at).toISOString().slice(0, 10)}</Field>
              {note.branch ? <Field label="Branch"><span className="font-mono text-xs">{note.branch}</span></Field> : null}
              {note.commit_sha ? (
                <Field label="Commit"><span className="font-mono text-xs">{note.commit_sha.slice(0, 10)}</span></Field>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
