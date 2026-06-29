// Shared domain types for LabNotes.

// Note kinds mirror the deeep-autoresearch logs:
//  - finding : measured result of an experiment (metric/value/delta) — the default
//  - research: a hypothesis/claim distilled from the literature (query/tool/sources)
//  - devlog  : the intent behind a code change (why/approach/alternative + commit)
export const NOTE_KINDS = ["finding", "research", "devlog"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

// Typed cross-note links. A finding `confirms`/`refutes` a research hypothesis;
// a devlog `satisfies` a hypothesis; `related` is a generic association.
export const NOTE_RELS = ["confirms", "refutes", "satisfies", "related"] as const;
export type NoteRel = (typeof NOTE_RELS)[number];
export type NoteRef = { rel: NoteRel; id: string };

// Conventional shape of `meta` per kind (stored loosely; read via the helpers below).
export type ResearchMeta = { query?: string; tool?: string; sources?: string[] };
export type DevlogMeta = { why?: string; approach?: string; alternative?: string };

export type Note = {
  id: string;
  project_id: string;
  author_login: string;
  kind: NoteKind;
  title: string;
  text: string | null;
  metric: string | null;
  value: number | null;
  delta: number | null;
  experiment: string | null;
  tags: string[];
  branch: string | null;
  commit_sha: string | null;
  verified: boolean;
  refs: NoteRef[];
  meta: Record<string, unknown> | null;
  created_at: number; // unix ms
};

// Typed views over the loose `meta` bag for the structured kinds.
export function researchMeta(note: Note): ResearchMeta {
  const m = (note.meta ?? {}) as Record<string, unknown>;
  const sources = Array.isArray(m.sources)
    ? (m.sources as unknown[]).map(String)
    : undefined;
  return {
    query: typeof m.query === "string" ? m.query : undefined,
    tool: typeof m.tool === "string" ? m.tool : undefined,
    sources,
  };
}

export function devlogMeta(note: Note): DevlogMeta {
  const m = (note.meta ?? {}) as Record<string, unknown>;
  return {
    why: typeof m.why === "string" ? m.why : undefined,
    approach: typeof m.approach === "string" ? m.approach : undefined,
    alternative: typeof m.alternative === "string" ? m.alternative : undefined,
  };
}

export const NOTE_REL_LABELS: Record<NoteRel, string> = {
  confirms: "confirms",
  refutes: "refutes",
  satisfies: "satisfies",
  related: "related to",
};

export type Project = {
  id: string; // canonical 'github.com/org/repo'
  repo_full_name: string; // 'org/repo'
  created_at: number;
  note_count?: number;
  last_at?: number | null;
};

export type ApiToken = {
  id: string;
  user_login: string;
  name: string;
  token_prefix: string;
  created_at: number;
  last_used_at: number | null;
};

// The authenticated principal behind a request — a human session or an agent token.
export type Actor = {
  login: string;
  // GitHub access token used to call the GitHub API on the actor's behalf.
  githubToken: string;
  source: "session" | "api_token";
};
