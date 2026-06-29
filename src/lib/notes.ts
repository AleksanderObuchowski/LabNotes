import { nanoid } from "nanoid";
import type { Row } from "@libsql/client";
import { db, ensureSchema } from "./db";
import { NOTE_KINDS, type Note, type NoteKind, type NoteRef, type Project } from "./types";

export function projectId(repoFullName: string): string {
  return `github.com/${repoFullName}`;
}

function asKind(v: unknown): NoteKind {
  return NOTE_KINDS.includes(v as NoteKind) ? (v as NoteKind) : "finding";
}

function parseRefs(v: unknown): NoteRef[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(String(v)) as unknown;
    return Array.isArray(arr) ? (arr as NoteRef[]) : [];
  } catch {
    return [];
  }
}

function rowToNote(r: Row): Note {
  return {
    id: String(r.id),
    project_id: String(r.project_id),
    author_login: String(r.author_login),
    kind: asKind(r.kind),
    title: String(r.title ?? ""),
    text: (r.text as string | null) ?? null,
    metric: (r.metric as string | null) ?? null,
    value: r.value === null ? null : Number(r.value),
    delta: r.delta === null ? null : Number(r.delta),
    experiment: (r.experiment as string | null) ?? null,
    tags: r.tags ? (JSON.parse(String(r.tags)) as string[]) : [],
    branch: (r.branch as string | null) ?? null,
    commit_sha: (r.commit_sha as string | null) ?? null,
    verified: Number(r.verified) === 1,
    refs: parseRefs(r.refs),
    meta: r.meta ? (JSON.parse(String(r.meta)) as Record<string, unknown>) : null,
    created_at: Number(r.created_at),
  };
}

async function ensureProject(repoFullName: string): Promise<void> {
  await db().execute({
    sql: `INSERT INTO projects (id, repo_full_name, created_at)
          VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING`,
    args: [projectId(repoFullName), repoFullName, Date.now()],
  });
}

export type CreateNoteInput = {
  repoFullName: string;
  authorLogin: string;
  kind?: NoteKind;
  title: string;
  text?: string | null;
  metric?: string | null;
  value?: number | null;
  delta?: number | null;
  experiment?: string | null;
  tags?: string[];
  branch?: string | null;
  commit?: string | null;
  refs?: NoteRef[];
  meta?: Record<string, unknown> | null;
  verified: boolean;
};

// Index the title, body, and any string values in `meta` (e.g. research
// query/sources, devlog why/approach) so FTS search reaches structured fields.
function ftsText(title: string, text?: string | null, meta?: Record<string, unknown> | null): string {
  const metaStr = meta
    ? Object.values(meta)
        .flat()
        .filter((v): v is string => typeof v === "string")
        .join(" ")
    : "";
  return `${title}\n${text ?? ""}\n${metaStr}`.trimEnd();
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  await ensureSchema();
  await ensureProject(input.repoFullName);
  const id = nanoid();
  const created_at = Date.now();
  const pid = projectId(input.repoFullName);
  const kind = input.kind ?? "finding";
  const refs = input.refs ?? [];
  await db().batch(
    [
      {
        sql: `INSERT INTO notes
                (id, project_id, author_login, kind, title, text, metric, value, delta,
                 experiment, tags, branch, commit_sha, verified, refs, meta, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          pid,
          input.authorLogin,
          kind,
          input.title,
          input.text ?? null,
          input.metric ?? null,
          input.value ?? null,
          input.delta ?? null,
          input.experiment ?? null,
          input.tags && input.tags.length ? JSON.stringify(input.tags) : null,
          input.branch ?? null,
          input.commit ?? null,
          input.verified ? 1 : 0,
          refs.length ? JSON.stringify(refs) : null,
          input.meta ? JSON.stringify(input.meta) : null,
          created_at,
        ],
      },
      {
        sql: `INSERT INTO notes_fts (note_id, text) VALUES (?, ?)`,
        args: [id, ftsText(input.title, input.text, input.meta)],
      },
    ],
    "write",
  );
  return {
    id,
    project_id: pid,
    author_login: input.authorLogin,
    kind,
    title: input.title,
    text: input.text ?? null,
    metric: input.metric ?? null,
    value: input.value ?? null,
    delta: input.delta ?? null,
    experiment: input.experiment ?? null,
    tags: input.tags ?? [],
    branch: input.branch ?? null,
    commit_sha: input.commit ?? null,
    verified: input.verified,
    refs,
    meta: input.meta ?? null,
    created_at,
  };
}

export type ListNotesParams = {
  repoFullName: string;
  q?: string;
  kind?: NoteKind;
  metric?: string;
  experiment?: string;
  tag?: string;
  verified?: boolean;
  limit?: number;
  cursor?: number; // created_at; returns notes strictly older than this
};

export async function listNotes(p: ListNotesParams): Promise<Note[]> {
  await ensureSchema();
  const where: string[] = ["project_id = ?"];
  const args: (string | number)[] = [projectId(p.repoFullName)];

  if (p.q) {
    where.push(
      `id IN (SELECT note_id FROM notes_fts WHERE notes_fts MATCH ?)`,
    );
    args.push(p.q.replace(/["']/g, " "));
  }
  if (p.kind) {
    where.push("kind = ?");
    args.push(p.kind);
  }
  if (p.metric) {
    where.push("metric = ?");
    args.push(p.metric);
  }
  if (p.experiment) {
    where.push("experiment = ?");
    args.push(p.experiment);
  }
  if (p.tag) {
    where.push("tags LIKE ?");
    args.push(`%"${p.tag}"%`);
  }
  if (p.verified !== undefined) {
    where.push("verified = ?");
    args.push(p.verified ? 1 : 0);
  }
  if (p.cursor !== undefined) {
    where.push("created_at < ?");
    args.push(p.cursor);
  }

  const limit = Math.min(Math.max(p.limit ?? 50, 1), 200);
  const res = await db().execute({
    sql: `SELECT * FROM notes WHERE ${where.join(" AND ")}
          ORDER BY created_at DESC LIMIT ?`,
    args: [...args, limit],
  });
  return res.rows.map(rowToNote);
}

export async function listProjects(): Promise<Project[]> {
  await ensureSchema();
  const res = await db().execute(
    `SELECT p.id, p.repo_full_name, p.created_at,
            COUNT(n.id) AS note_count, MAX(n.created_at) AS last_at
     FROM projects p LEFT JOIN notes n ON n.project_id = p.id
     GROUP BY p.id ORDER BY MAX(n.created_at) DESC`,
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    repo_full_name: String(r.repo_full_name),
    created_at: Number(r.created_at),
    note_count: Number(r.note_count),
    last_at: r.last_at === null ? null : Number(r.last_at),
  }));
}

export type ProjectStats = {
  notes: number;
  verified: number;
  experiments: number;
  findings: number;
  research: number;
  devlog: number;
};

// Aggregate stats restricted to a set of project ids (the ones a user can see).
export async function statsForProjects(projectIds: string[]): Promise<ProjectStats> {
  const empty: ProjectStats = { notes: 0, verified: 0, experiments: 0, findings: 0, research: 0, devlog: 0 };
  if (projectIds.length === 0) return empty;
  await ensureSchema();
  const placeholders = projectIds.map(() => "?").join(",");
  const res = await db().execute({
    sql: `SELECT COUNT(*) AS notes,
                 COALESCE(SUM(verified), 0) AS verified,
                 COUNT(DISTINCT experiment) AS experiments,
                 COALESCE(SUM(kind = 'finding'), 0) AS findings,
                 COALESCE(SUM(kind = 'research'), 0) AS research,
                 COALESCE(SUM(kind = 'devlog'), 0) AS devlog
          FROM notes WHERE project_id IN (${placeholders})`,
    args: projectIds,
  });
  const r = res.rows[0];
  return {
    notes: Number(r.notes),
    verified: Number(r.verified),
    experiments: Number(r.experiments),
    findings: Number(r.findings),
    research: Number(r.research),
    devlog: Number(r.devlog),
  };
}

const KIND_TAG: Record<NoteKind, string> = {
  finding: "📊 finding",
  research: "🔬 research",
  devlog: "🛠 devlog",
};

// Compact, token-efficient markdown of a project's notes — the default read
// path for LLM agents (avoids the key-repetition cost of raw JSON). Groups by
// experiment, tags each note by kind, and renders cross-note links so the
// research → devlog → finding trail is visible at a glance.
export function buildDigest(repoFullName: string, notes: Note[]): string {
  const lines: string[] = [`# LabNotes — ${repoFullName}`, ""];
  if (notes.length === 0) {
    lines.push("_No notes logged yet._");
    return lines.join("\n");
  }

  // Resolve link targets to their titles (notes are append-only, so ids are stable).
  const byId = new Map(notes.map((n) => [n.id, n]));
  const titleFor = (id: string) => byId.get(id)?.title ?? id;

  const groups = new Map<string, Note[]>();
  for (const n of notes) {
    const key = n.experiment ?? "(ungrouped)";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(n);
  }

  const fmtDelta = (d: number | null) =>
    d === null ? "" : ` (${d > 0 ? "+" : ""}${d})`;

  for (const [experiment, group] of groups) {
    lines.push(`## ${experiment}`);
    for (const n of group) {
      const metric = n.metric ? `**${n.metric}**${fmtDelta(n.delta)}: ` : "";
      const flag = n.verified ? "✓" : "unverified";
      const sha = n.commit_sha ? n.commit_sha.slice(0, 7) : "—";
      const date = new Date(n.created_at).toISOString().slice(0, 10);
      lines.push(
        `- [${KIND_TAG[n.kind]}] ${metric}${n.title} _(${flag}, ${sha}, ${date}, @${n.author_login})_`,
      );
      for (const ref of n.refs) {
        lines.push(`  ↳ ${ref.rel}: ${titleFor(ref.id)}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
