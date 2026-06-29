"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  CircleDashed,
  FileText,
  GitBranch,
  ListFilter,
  Search,
} from "lucide-react";
import type { Note } from "@/lib/types";
import { AddNoteDialog } from "@/components/add-note-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NoteDialog } from "@/components/note-dialog";

const ALL = "__all__";

function DeltaCell({ metric, value, delta }: Pick<Note, "metric" | "value" | "delta">) {
  if (!metric) return <span className="text-muted-foreground">—</span>;
  const Icon = delta == null ? ArrowRight : delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : ArrowRight;
  const color = delta == null || delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-emerald-500" : "text-red-500";
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <span className="text-foreground">{metric}</span>
      {delta != null ? (
        <span className={`inline-flex items-center gap-0.5 ${color}`}>
          <Icon className="size-3" />
          {delta > 0 ? "+" : ""}{delta}
        </span>
      ) : value != null ? (
        <span className="text-muted-foreground">{value}</span>
      ) : null}
    </div>
  );
}

function StatusCell({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <CheckCircle2 className="size-4 text-emerald-500" />
      Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <CircleDashed className="size-4" />
      Unverified
    </span>
  );
}

function NoteRow({ note, onSelect }: { note: Note; onSelect: (n: Note) => void }) {
  const date = new Date(note.created_at).toISOString().slice(0, 10);
  return (
    <TableRow className="cursor-pointer" onClick={() => onSelect(note)}>
      <TableCell className="max-w-[460px]">
        <div className="flex items-center gap-2">
          {note.experiment ? (
            <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
              {note.experiment}
            </Badge>
          ) : null}
          <span className="truncate font-medium">{note.title}</span>
        </div>
        {note.text ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{note.text}</p>
        ) : null}
        {note.tags.length ? (
          <div className="mt-1 flex gap-1">
            {note.tags.map((t) => (
              <span key={t} className="text-[11px] text-muted-foreground">#{t}</span>
            ))}
          </div>
        ) : null}
      </TableCell>
      <TableCell>
        <DeltaCell metric={note.metric} value={note.value} delta={note.delta} />
      </TableCell>
      <TableCell><StatusCell verified={note.verified} /></TableCell>
      <TableCell className="text-muted-foreground">@{note.author_login}</TableCell>
      <TableCell className="text-muted-foreground">{date}</TableCell>
      <TableCell className="text-right">
        {note.commit_sha ? (
          <Tooltip>
            <TooltipTrigger className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
              <GitBranch className="size-3" />
              {note.commit_sha.slice(0, 7)}
            </TooltipTrigger>
            <TooltipContent className="font-mono">
              {note.branch} · {note.commit_sha}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function ProjectFeed({
  repo,
  notes,
  canWrite,
}: {
  repo: string;
  notes: Note[];
  canWrite: boolean;
}) {
  const [q, setQ] = useState("");
  const [metric, setMetric] = useState(ALL);
  const [verified, setVerified] = useState(ALL);
  const [grouped, setGrouped] = useState(false);
  const [selected, setSelected] = useState<Note | null>(null);

  const metrics = useMemo(
    () => Array.from(new Set(notes.map((n) => n.metric).filter(Boolean))) as string[],
    [notes],
  );
  const verifiedCount = useMemo(() => notes.filter((n) => n.verified).length, [notes]);
  const experimentCount = useMemo(
    () => new Set(notes.map((n) => n.experiment).filter(Boolean)).size,
    [notes],
  );

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return notes.filter((n) => {
      if (ql && !`${n.title} ${n.text ?? ""}`.toLowerCase().includes(ql)) return false;
      if (metric !== ALL && n.metric !== metric) return false;
      if (verified === "yes" && !n.verified) return false;
      if (verified === "no" && n.verified) return false;
      return true;
    });
  }, [notes, q, metric, verified]);

  const groups = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of filtered) {
      const k = n.experiment ?? "(ungrouped)";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(n);
    }
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{repo}</h1>
          <p className="text-sm text-muted-foreground">
            {notes.length} findings · {verifiedCount} verified · {experimentCount} experiments ·{" "}
            <Link
              href={`/api/v1/digest?project=${repo}`}
              className="underline decoration-dotted hover:text-foreground"
              target="_blank"
            >
              view digest
            </Link>
          </p>
        </div>
        {canWrite ? <AddNoteDialog repo={repo} /> : null}
      </div>

      {/* Panel */}
      <div className="rounded-xl border bg-card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter findings…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-[230px] pl-8"
            />
          </div>
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger size="sm" className="h-9">
              <ListFilter className="size-4" />
              <SelectValue placeholder="Metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All metrics</SelectItem>
              {metrics.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={verified} onValueChange={setVerified}>
            <SelectTrigger size="sm" className="h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any status</SelectItem>
              <SelectItem value="yes">Verified</SelectItem>
              <SelectItem value="no">Unverified</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Tabs value={grouped ? "experiment" : "all"} onValueChange={(v) => setGrouped(v === "experiment")}>
            <TabsList>
              <TabsTrigger value="all">Timeline</TabsTrigger>
              <TabsTrigger value="experiment">By experiment</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No matching findings.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Finding</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Commit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped
                ? groups.flatMap(([experiment, group]) => [
                    <TableRow key={`g-${experiment}`} className="hover:bg-transparent">
                      <TableCell colSpan={6} className="bg-muted/30 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {experiment} · {group.length}
                      </TableCell>
                    </TableRow>,
                    ...group.map((n) => <NoteRow key={n.id} note={n} onSelect={setSelected} />),
                  ])
                : filtered.map((n) => <NoteRow key={n.id} note={n} onSelect={setSelected} />)}
            </TableBody>
          </Table>
        )}
      </div>

      <NoteDialog note={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
