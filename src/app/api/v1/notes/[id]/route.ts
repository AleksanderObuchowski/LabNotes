import { resolveActor } from "@/lib/actor";
import { commitExists, hasPushAccess } from "@/lib/github";
import { apiError, json } from "@/lib/http";
import { deleteNote, getNote, repoFromProjectId, updateNote } from "@/lib/notes";
import { updateNoteSchema } from "@/lib/validation";

// Update an existing note (partial). Requires push access to the owning repo.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveActor(req);
  if (!actor) return apiError("Unauthorized", 401);

  const { id } = await ctx.params;
  const note = await getNote(id);
  if (!note) return apiError("Note not found", 404);

  const repoFullName = repoFromProjectId(note.project_id);
  if (!(await hasPushAccess(actor.githubToken, repoFullName))) {
    return apiError("You do not have push access to this repo", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = updateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues.map((i) => i.message).join("; "), 422);
  }
  const data = parsed.data;

  // Re-run soft verification only when the commit reference changes.
  let verified: boolean | undefined;
  if (data.commit !== undefined) {
    verified = data.commit
      ? await commitExists(actor.githubToken, repoFullName, data.commit)
      : false;
  }

  const updated = await updateNote(id, { ...data, verified });
  return json(updated);
}

// Delete a note. Requires push access to the owning repo.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveActor(req);
  if (!actor) return apiError("Unauthorized", 401);

  const { id } = await ctx.params;
  const note = await getNote(id);
  if (!note) return apiError("Note not found", 404);

  const repoFullName = repoFromProjectId(note.project_id);
  if (!(await hasPushAccess(actor.githubToken, repoFullName))) {
    return apiError("You do not have push access to this repo", 403);
  }

  await deleteNote(id);
  return json({ ok: true });
}
