"use client";

import { useMemo } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  CircleDashed,
  CornerDownRight,
  CornerLeftUp,
} from "lucide-react";
import { devlogMeta, researchMeta, NOTE_REL_LABELS, type Note } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Markdown } from "@/components/markdown";
import { KindBadge, KIND_META } from "@/components/kind-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

// A clickable row linking to another note (forward ref or incoming backlink).
function LinkRow({
  icon: Icon,
  rel,
  target,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>;
  rel: string;
  target: Note;
  onSelect: (n: Note) => void;
}) {
  const KindIcon = KIND_META[target.kind].icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(target)}
      className="flex w-full items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60"
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-xs text-muted-foreground">{rel}</span>
      <KindIcon className={`size-3.5 shrink-0 ${KIND_META[target.kind].className.split(" ")[0]}`} />
      <span className="truncate">{target.title}</span>
    </button>
  );
}

export function NoteDialog({
  note,
  notesById,
  allNotes,
  onSelect,
  onOpenChange,
}: {
  note: Note | null;
  notesById: Map<string, Note>;
  allNotes: Note[];
  onSelect: (n: Note) => void;
  onOpenChange: (open: boolean) => void;
}) {
  // Outgoing links (this note's refs) and incoming backlinks (notes that point here).
  const outgoing = useMemo(
    () =>
      (note?.refs ?? [])
        .map((r) => ({ rel: NOTE_REL_LABELS[r.rel], target: notesById.get(r.id) }))
        .filter((l): l is { rel: string; target: Note } => Boolean(l.target)),
    [note, notesById],
  );
  const incoming = useMemo(() => {
    if (!note) return [];
    return allNotes.flatMap((n) =>
      n.refs
        .filter((r) => r.id === note.id)
        .map((r) => ({ rel: NOTE_REL_LABELS[r.rel], target: n })),
    );
  }, [note, allNotes]);

  const research = note?.kind === "research" ? researchMeta(note) : null;
  const devlog = note?.kind === "devlog" ? devlogMeta(note) : null;

  return (
    <Dialog open={!!note} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {note ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <KindBadge kind={note.kind} />
                {note.experiment ? (
                  <Badge variant="outline" className="font-normal text-muted-foreground">
                    {note.experiment}
                  </Badge>
                ) : null}
                {note.kind === "finding" ? (
                  note.verified ? (
                    <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                      <CheckCircle2 className="size-3" /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                      <CircleDashed className="size-3" /> Unverified
                    </Badge>
                  )
                ) : null}
              </div>
              <DialogTitle className="text-xl leading-snug">{note.title}</DialogTitle>
            </DialogHeader>

            {/* Kind-specific structured fields */}
            {research ? (
              <div>
                {research.query ? (
                  <Field label="Query"><span className="font-mono text-xs">{research.query}</span></Field>
                ) : null}
                {research.tool ? <Field label="Tool">{research.tool}</Field> : null}
                {research.sources?.length ? (
                  <Field label="Sources">
                    <span className="flex flex-col items-end gap-0.5 font-mono text-xs">
                      {research.sources.map((s, i) => (
                        <span key={i}>{s}</span>
                      ))}
                    </span>
                  </Field>
                ) : null}
              </div>
            ) : null}
            {devlog ? (
              <div className="space-y-2 text-sm">
                {devlog.why ? <p><span className="text-muted-foreground">Why: </span>{devlog.why}</p> : null}
                {devlog.approach ? <p><span className="text-muted-foreground">Approach: </span>{devlog.approach}</p> : null}
                {devlog.alternative ? <p><span className="text-muted-foreground">Alternative: </span>{devlog.alternative}</p> : null}
              </div>
            ) : null}

            {note.text ? <Markdown>{note.text}</Markdown> : null}

            {/* Cross-note links */}
            {outgoing.length || incoming.length ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Links</p>
                {outgoing.map((l, i) => (
                  <LinkRow key={`o-${i}`} icon={CornerDownRight} rel={l.rel} target={l.target} onSelect={onSelect} />
                ))}
                {incoming.map((l, i) => (
                  <LinkRow key={`i-${i}`} icon={CornerLeftUp} rel={`${l.rel} this`} target={l.target} onSelect={onSelect} />
                ))}
              </div>
            ) : null}

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
