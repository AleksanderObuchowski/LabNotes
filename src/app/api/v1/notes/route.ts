import { resolveActor } from "@/lib/actor";
import { commitExists, hasPushAccess, hasReadAccess, normalizeRepo } from "@/lib/github";
import { apiError, json } from "@/lib/http";
import { createNote, listNotes } from "@/lib/notes";
import { NOTE_KINDS, type Note, type NoteKind } from "@/lib/types";
import { createNoteSchema } from "@/lib/validation";

const NOTE_FIELDS: (keyof Note)[] = [
  "id", "project_id", "author_login", "kind", "title", "text", "metric", "value", "delta",
  "experiment", "tags", "branch", "commit_sha", "verified", "refs", "meta", "created_at",
];

function pickFields(param: string | null): (keyof Note)[] {
  if (!param) return NOTE_FIELDS;
  const requested = param.split(",").map((s) => s.trim());
  const picked = NOTE_FIELDS.filter((f) => requested.includes(f));
  return picked.length ? picked : NOTE_FIELDS;
}

function parseKind(param: string | null): NoteKind | undefined {
  return param && NOTE_KINDS.includes(param as NoteKind) ? (param as NoteKind) : undefined;
}

export async function POST(req: Request) {
  const actor = await resolveActor(req);
  if (!actor) return apiError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues.map((i) => i.message).join("; "), 422);
  }
  const data = parsed.data;

  const repoFullName = normalizeRepo(data.repo);
  if (!repoFullName) return apiError("Could not parse repo", 400);

  if (!(await hasPushAccess(actor.githubToken, repoFullName))) {
    return apiError("You do not have push access to this repo", 403);
  }

  // Soft verification: flag the note if the commit isn't (yet) on GitHub.
  const verified = data.commit
    ? await commitExists(actor.githubToken, repoFullName, data.commit)
    : false;

  const note = await createNote({
    repoFullName,
    authorLogin: actor.login,
    kind: data.kind,
    title: data.title,
    text: data.text ?? null,
    metric: data.metric ?? null,
    value: data.value ?? null,
    delta: data.delta ?? null,
    experiment: data.experiment ?? null,
    tags: data.tags ?? [],
    branch: data.branch ?? null,
    commit: data.commit ?? null,
    refs: data.refs ?? [],
    meta: data.meta ?? null,
    verified,
  });

  return json(note, 201);
}

export async function GET(req: Request) {
  const actor = await resolveActor(req);
  if (!actor) return apiError("Unauthorized", 401);

  const url = new URL(req.url);
  const sp = url.searchParams;
  const project = sp.get("project");
  if (!project) return apiError("project query param is required", 400);

  const repoFullName = normalizeRepo(project);
  if (!repoFullName) return apiError("Could not parse project repo", 400);

  if (!(await hasReadAccess(actor.githubToken, repoFullName))) {
    return apiError("You do not have access to this repo", 403);
  }

  const verifiedParam = sp.get("verified");
  const notes = await listNotes({
    repoFullName,
    q: sp.get("q") ?? undefined,
    kind: parseKind(sp.get("kind")),
    metric: sp.get("metric") ?? undefined,
    experiment: sp.get("experiment") ?? undefined,
    tag: sp.get("tag") ?? undefined,
    verified: verifiedParam === null ? undefined : verifiedParam === "true",
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    cursor: sp.get("cursor") ? Number(sp.get("cursor")) : undefined,
  });

  const fields = pickFields(sp.get("fields"));
  const nextCursor = notes.length ? notes[notes.length - 1].created_at : null;

  // format=table trades JSON's repeated keys for a columns+rows shape.
  if (sp.get("format") === "table") {
    return json({
      columns: fields,
      rows: notes.map((n) => fields.map((f) => n[f])),
      next_cursor: nextCursor,
    });
  }

  const shaped = notes.map((n) =>
    Object.fromEntries(fields.map((f) => [f, n[f]])),
  );
  return json({ notes: shaped, next_cursor: nextCursor });
}
