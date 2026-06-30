"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  devlogMeta,
  researchMeta,
  NOTE_KINDS,
  NOTE_RELS,
  type Note,
  type NoteKind,
  type NoteRef,
} from "@/lib/types";
import { KIND_META } from "@/components/kind-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const COPY: Record<NoteKind, { verb: string; title: string; desc: string; placeholder: string }> = {
  finding: {
    verb: "finding",
    title: "Log a finding",
    desc: "A measured result or observation. Only the title is required — metrics are optional.",
    placeholder: "Chunk size 512 raises retrieval accuracy by ~3%",
  },
  research: {
    verb: "research note",
    title: "Log a research note",
    desc: "A hypothesis or claim distilled from the literature — the provenance a finding can later confirm.",
    placeholder: "Larger chunks should raise retrieval accuracy on long docs",
  },
  devlog: {
    verb: "devlog",
    title: "Log a devlog entry",
    desc: "The intent behind a code change — why you changed it, not the diff.",
    placeholder: "Switch chunker to 512-token windows with 64 overlap",
  },
};

const DEFAULT_REL: Record<NoteKind, (typeof NOTE_RELS)[number]> = {
  finding: "confirms",
  devlog: "satisfies",
  research: "related",
};

export function AddNoteDialog({
  repo,
  notes,
  editNote,
  open: controlledOpen,
  onOpenChange,
}: {
  repo: string;
  notes: Note[];
  editNote?: Note;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const editMode = !!editNote;
  const controlled = controlledOpen !== undefined;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? controlledOpen : internalOpen;
  const setOpen = (o: boolean) => (controlled ? onOpenChange?.(o) : setInternalOpen(o));

  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<NoteKind>(editNote?.kind ?? "finding");
  const [links, setLinks] = useState<NoteRef[]>(editNote?.refs ?? []);
  const [relDraft, setRelDraft] = useState<(typeof NOTE_RELS)[number]>(
    editNote ? DEFAULT_REL[editNote.kind] : "confirms",
  );
  const [targetDraft, setTargetDraft] = useState<string>("");

  // Prefill values for edit mode (inputs are uncontrolled; the parent remounts
  // this dialog per note via a `key`, so defaultValue reflects the right note).
  const rm = editNote ? researchMeta(editNote) : null;
  const dm = editNote ? devlogMeta(editNote) : null;
  // Can't link a note to itself.
  const linkTargets = notes.filter((n) => n.id !== editNote?.id);

  function reset() {
    if (editMode) return; // edit dialogs are remounted fresh per note
    setKind("finding");
    setLinks([]);
    setRelDraft("confirms");
    setTargetDraft("");
  }

  function changeKind(k: NoteKind) {
    setKind(k);
    setRelDraft(DEFAULT_REL[k]);
  }

  function addLink() {
    if (!targetDraft) return;
    if (links.some((l) => l.rel === relDraft && l.id === targetDraft)) return;
    setLinks((prev) => [...prev, { rel: relDraft, id: targetDraft }]);
    setTargetDraft("");
  }

  const titleOf = (id: string) => notes.find((n) => n.id === id)?.title ?? id;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) {
      toast.error("Title is required");
      return;
    }
    const text = String(fd.get("text") ?? "").trim();
    // In edit mode, empty fields clear the value (send null); in create mode they're omitted.
    const blank = editMode ? null : undefined;
    const num = (k: string) => {
      const v = String(fd.get(k) ?? "").trim();
      return v === "" ? blank : Number(v);
    };
    const str = (k: string) => {
      const v = String(fd.get(k) ?? "").trim();
      return v === "" ? blank : v;
    };
    const tagsRaw = String(fd.get("tags") ?? "").trim();
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : blank;

    // Kind-specific structured fields ride in `meta`.
    let meta: Record<string, unknown> | null | undefined;
    if (kind === "research") {
      const sourcesRaw = String(fd.get("sources") ?? "").trim();
      const sources = sourcesRaw ? sourcesRaw.split("\n").map((s) => s.trim()).filter(Boolean) : undefined;
      meta = { query: str("query") ?? undefined, tool: str("tool") ?? undefined, sources };
    } else if (kind === "devlog") {
      meta = {
        why: str("why") ?? undefined,
        approach: str("approach") ?? undefined,
        alternative: str("alternative") ?? undefined,
      };
    }
    if (meta && Object.values(meta).every((v) => v === undefined)) meta = blank;

    setSaving(true);
    try {
      const payload = {
        ...(editMode ? {} : { repo }),
        kind,
        title,
        text: text || blank,
        metric: kind === "finding" ? str("metric") : blank,
        value: kind === "finding" ? num("value") : blank,
        delta: kind === "finding" ? num("delta") : blank,
        experiment: str("experiment"),
        tags,
        branch: kind !== "research" ? str("branch") : blank,
        commit: kind !== "research" ? str("commit") : blank,
        refs: editMode ? links : links.length ? links : undefined,
        meta,
      };
      const res = await fetch(
        editMode ? `/api/v1/notes/${editNote!.id}` : "/api/v1/notes",
        {
          method: editMode ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      toast.success(editMode ? "Note updated" : `${COPY[kind].verb[0].toUpperCase()}${COPY[kind].verb.slice(1)} logged`);
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  const copy = COPY[kind];
  const heading = editMode ? "Edit note" : copy.title;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      {controlled ? null : (
        <DialogTrigger asChild>
          <Button>Add note</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{heading}</DialogTitle>
            <DialogDescription>
              {copy.desc} For <code>{repo}</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Kind selector */}
            <Tabs value={kind} onValueChange={(v) => changeKind(v as NoteKind)}>
              <TabsList className="grid w-full grid-cols-3">
                {NOTE_KINDS.map((k) => (
                  <TabsTrigger key={k} value={k}>{KIND_META[k].label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required placeholder={copy.placeholder} defaultValue={editNote?.title} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="text">
                {kind === "research" ? "Distilled detail" : "Details"}{" "}
                <span className="text-muted-foreground">(optional, markdown)</span>
              </Label>
              <Textarea
                id="text"
                name="text"
                placeholder="Longer notes, context, caveats, how you measured it…"
                rows={4}
                defaultValue={editNote?.text ?? ""}
              />
            </div>

            {/* Finding-specific */}
            {kind === "finding" ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="metric">Metric</Label>
                  <Input id="metric" name="metric" placeholder="accuracy" defaultValue={editNote?.metric ?? ""} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="value">Value</Label>
                  <Input id="value" name="value" type="number" step="any" placeholder="0.92" defaultValue={editNote?.value ?? ""} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="delta">Delta</Label>
                  <Input id="delta" name="delta" type="number" step="any" placeholder="0.03" defaultValue={editNote?.delta ?? ""} />
                </div>
              </div>
            ) : null}

            {/* Research-specific */}
            {kind === "research" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="query">Query</Label>
                    <Input id="query" name="query" placeholder="optimal chunk size RAG" defaultValue={rm?.query ?? ""} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tool">Tool</Label>
                    <Input id="tool" name="tool" placeholder="arxiv" defaultValue={rm?.tool ?? ""} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sources">
                    Sources <span className="text-muted-foreground">(one per line)</span>
                  </Label>
                  <Textarea
                    id="sources"
                    name="sources"
                    rows={3}
                    placeholder={"arXiv:2310.xxxxx\nhttps://…"}
                    defaultValue={rm?.sources?.join("\n") ?? ""}
                  />
                </div>
              </>
            ) : null}

            {/* Devlog-specific */}
            {kind === "devlog" ? (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="why">Why</Label>
                  <Input id="why" name="why" placeholder="What problem this change addresses" defaultValue={dm?.why ?? ""} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="approach">Approach</Label>
                  <Input id="approach" name="approach" placeholder="What you changed, at the level of intent" defaultValue={dm?.approach ?? ""} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="alternative">Alternative considered</Label>
                  <Input id="alternative" name="alternative" placeholder="What you didn't do and why" defaultValue={dm?.alternative ?? ""} />
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="experiment">Experiment</Label>
                <Input id="experiment" name="experiment" placeholder="rag-chunking" defaultValue={editNote?.experiment ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tags">Tags</Label>
                <Input id="tags" name="tags" placeholder="rag, prompt" defaultValue={editNote?.tags.join(", ") ?? ""} />
              </div>
            </div>

            {kind !== "research" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Input id="branch" name="branch" placeholder="main" defaultValue={editNote?.branch ?? ""} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="commit">Commit SHA</Label>
                  <Input id="commit" name="commit" placeholder="abc1234…" defaultValue={editNote?.commit_sha ?? ""} />
                </div>
              </div>
            ) : null}

            {/* Links to other notes */}
            <div className="grid gap-2">
              <Label>
                Links <span className="text-muted-foreground">(optional)</span>
              </Label>
              {links.length ? (
                <div className="flex flex-col gap-1.5">
                  {links.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm">
                      <span className="shrink-0 text-xs text-muted-foreground">{l.rel}</span>
                      <span className="truncate">{titleOf(l.id)}</span>
                      <button
                        type="button"
                        onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                        className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label="Remove link"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {linkTargets.length ? (
                <div className="flex items-center gap-2">
                  <Select value={relDraft} onValueChange={(v) => setRelDraft(v as (typeof NOTE_RELS)[number])}>
                    <SelectTrigger size="sm" className="h-9 w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTE_RELS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={targetDraft} onValueChange={setTargetDraft}>
                    <SelectTrigger size="sm" className="h-9 flex-1">
                      <SelectValue placeholder="Pick a note…" />
                    </SelectTrigger>
                    <SelectContent>
                      {linkTargets.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          [{KIND_META[n.kind].label}] {n.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="outline" className="size-9 shrink-0" onClick={addLink} aria-label="Add link">
                    <Plus className="size-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No other notes to link yet.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editMode ? "Save changes" : heading}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
