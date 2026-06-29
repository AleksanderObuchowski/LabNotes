import { auth } from "@/auth";
import { db, ensureSchema } from "./db";
import { lookupToken } from "./tokens";
import { DEV_LOGIN, DEV_TOKEN, devMode } from "./dev";
import type { Actor } from "./types";

function devActor(source: Actor["source"]): Actor {
  return { login: DEV_LOGIN as string, githubToken: DEV_TOKEN, source };
}

async function githubTokenFor(login: string): Promise<string | null> {
  await ensureSchema();
  const res = await db().execute({
    sql: `SELECT github_token FROM users WHERE login = ? LIMIT 1`,
    args: [login],
  });
  const row = res.rows[0];
  return row ? (row.github_token as string | null) : null;
}

// Resolve the principal from the browser session only (for Server Components).
export async function sessionActor(): Promise<Actor | null> {
  if (devMode) return devActor("session");
  const session = await auth();
  const login = session?.user?.login;
  if (!login) return null;
  const githubToken = await githubTokenFor(login);
  if (!githubToken) return null;
  return { login, githubToken, source: "session" };
}

// Resolve the principal behind a request: a bearer API token (agent) or the
// browser session (human). Both carry the user's stored GitHub token so that
// permission checks hit the real GitHub API.
export async function resolveActor(req: Request): Promise<Actor | null> {
  const authz = req.headers.get("authorization");
  if (devMode && !authz) return devActor("session");
  if (authz?.startsWith("Bearer ")) {
    const token = authz.slice("Bearer ".length).trim();
    const login = await lookupToken(token);
    if (!login) return null;
    const githubToken = await githubTokenFor(login);
    if (!githubToken) return null;
    return { login, githubToken, source: "api_token" };
  }

  const session = await auth();
  const login = session?.user?.login;
  if (!login) return null;
  const githubToken = await githubTokenFor(login);
  if (!githubToken) return null;
  return { login, githubToken, source: "session" };
}
