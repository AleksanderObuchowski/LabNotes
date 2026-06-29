import { createHash, randomBytes } from "node:crypto";
import { nanoid } from "nanoid";
import { db, ensureSchema } from "./db";

// API tokens are shown to the user exactly once; we persist only their hash.
const PREFIX = "lnk_";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type MintedToken = { id: string; name: string; token: string; token_prefix: string };

export async function mintToken(userLogin: string, name: string): Promise<MintedToken> {
  await ensureSchema();
  const secret = randomBytes(24).toString("base64url");
  const token = `${PREFIX}${secret}`;
  const id = nanoid();
  const token_prefix = token.slice(0, PREFIX.length + 6); // e.g. lnk_Ab12Cd
  await db().execute({
    sql: `INSERT INTO api_tokens (id, user_login, name, token_hash, token_prefix, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, userLogin, name, hashToken(token), token_prefix, Date.now()],
  });
  return { id, name, token, token_prefix };
}

export type TokenSummary = {
  id: string;
  name: string;
  token_prefix: string;
  created_at: number;
  last_used_at: number | null;
};

export async function listTokens(userLogin: string): Promise<TokenSummary[]> {
  await ensureSchema();
  const res = await db().execute({
    sql: `SELECT id, name, token_prefix, created_at, last_used_at
          FROM api_tokens WHERE user_login = ? ORDER BY created_at DESC`,
    args: [userLogin],
  });
  return res.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    token_prefix: String(r.token_prefix),
    created_at: Number(r.created_at),
    last_used_at: r.last_used_at === null ? null : Number(r.last_used_at),
  }));
}

// Deletes a token only if it belongs to the user. Returns whether a row was removed.
export async function deleteToken(userLogin: string, id: string): Promise<boolean> {
  await ensureSchema();
  const res = await db().execute({
    sql: `DELETE FROM api_tokens WHERE id = ? AND user_login = ?`,
    args: [id, userLogin],
  });
  return res.rowsAffected > 0;
}

// Resolve a bearer token to its owning user login, or null if unknown.
export async function lookupToken(token: string): Promise<string | null> {
  if (!token.startsWith(PREFIX)) return null;
  await ensureSchema();
  const res = await db().execute({
    sql: `SELECT user_login FROM api_tokens WHERE token_hash = ? LIMIT 1`,
    args: [hashToken(token)],
  });
  const row = res.rows[0];
  if (!row) return null;
  // Best-effort last-used stamp (don't block the request on it).
  void db().execute({
    sql: `UPDATE api_tokens SET last_used_at = ? WHERE token_hash = ?`,
    args: [Date.now(), hashToken(token)],
  });
  return String(row.user_login);
}
