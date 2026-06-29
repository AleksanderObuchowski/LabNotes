import { resolveActor } from "@/lib/actor";
import { hasReadAccess, normalizeRepo } from "@/lib/github";
import { apiError } from "@/lib/http";
import { buildDigest, listNotes } from "@/lib/notes";
import { NOTE_KINDS, type NoteKind } from "@/lib/types";

// Markdown findings digest — the default, token-efficient read path for agents.
// Repo is passed as ?project=owner/repo (Next disallows a non-terminal catch-all).
export async function GET(req: Request) {
  const actor = await resolveActor(req);
  if (!actor) return apiError("Unauthorized", 401);

  const url = new URL(req.url);
  const project = url.searchParams.get("project");
  if (!project) return apiError("project query param is required", 400);

  const repoFullName = normalizeRepo(project);
  if (!repoFullName) return apiError("Could not parse project repo", 400);

  if (!(await hasReadAccess(actor.githubToken, repoFullName))) {
    return apiError("You do not have access to this repo", 403);
  }

  const kindParam = url.searchParams.get("kind");
  const kind =
    kindParam && NOTE_KINDS.includes(kindParam as NoteKind) ? (kindParam as NoteKind) : undefined;
  const notes = await listNotes({
    repoFullName,
    kind,
    experiment: url.searchParams.get("experiment") ?? undefined,
    metric: url.searchParams.get("metric") ?? undefined,
    limit: 200,
  });

  return new Response(buildDigest(repoFullName, notes), {
    status: 200,
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
