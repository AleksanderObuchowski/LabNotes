import { resolveActor } from "@/lib/actor";
import { apiError, json } from "@/lib/http";
import { listTokens, mintToken } from "@/lib/tokens";
import { createTokenSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const actor = await resolveActor(req);
  if (!actor) return apiError("Unauthorized", 401);
  return json({ tokens: await listTokens(actor.login) });
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
  const parsed = createTokenSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues.map((i) => i.message).join("; "), 422);
  }

  // The full token is returned exactly once here.
  const minted = await mintToken(actor.login, parsed.data.name);
  return json(minted, 201);
}
