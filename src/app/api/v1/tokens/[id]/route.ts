import { resolveActor } from "@/lib/actor";
import { apiError, json } from "@/lib/http";
import { deleteToken } from "@/lib/tokens";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveActor(req);
  if (!actor) return apiError("Unauthorized", 401);

  const { id } = await ctx.params;
  const removed = await deleteToken(actor.login, id);
  if (!removed) return apiError("Token not found", 404);
  return json({ ok: true });
}
