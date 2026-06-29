// Thin GitHub REST API wrapper. All calls are made on behalf of a user,
// using their OAuth access token, so permissions are inherited from GitHub.

import { DEV_TOKEN, devMode } from "./dev";

const API = "https://api.github.com";

function gh(token: string, path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
    // GitHub data changes rarely for our needs; let Next cache briefly.
    cache: "no-store",
  });
}

export type Viewer = { login: string; name: string | null; avatar_url: string | null };

export async function getViewer(token: string): Promise<Viewer | null> {
  const res = await gh(token, "/user");
  if (!res.ok) return null;
  const j = (await res.json()) as Viewer;
  return { login: j.login, name: j.name ?? null, avatar_url: j.avatar_url ?? null };
}

// True when the user can push to the repo (push or admin permission).
export async function hasPushAccess(token: string, repoFullName: string): Promise<boolean> {
  if (devMode && token === DEV_TOKEN) return true;
  const res = await gh(token, `/repos/${repoFullName}`);
  if (!res.ok) return false;
  const j = (await res.json()) as { permissions?: { push?: boolean; admin?: boolean; maintain?: boolean } };
  const p = j.permissions;
  return Boolean(p?.push || p?.admin || p?.maintain);
}

// True when the repo is visible to the user (at least read access).
export async function hasReadAccess(token: string, repoFullName: string): Promise<boolean> {
  if (devMode && token === DEV_TOKEN) return true;
  const res = await gh(token, `/repos/${repoFullName}`);
  return res.ok;
}

// True when the commit SHA resolves in the repo (used for soft verification).
export async function commitExists(
  token: string,
  repoFullName: string,
  sha: string,
): Promise<boolean> {
  if (!sha) return false;
  if (devMode && token === DEV_TOKEN) return true;
  const res = await gh(token, `/repos/${repoFullName}/commits/${sha}`);
  return res.ok;
}

// Normalise any repo reference (URL, git@, owner/repo) to canonical 'owner/repo'.
export function normalizeRepo(input: string): string | null {
  const s = input.trim().replace(/\.git$/, "");
  // git@github.com:owner/repo
  const ssh = s.match(/^git@github\.com:([^/]+\/[^/]+)$/);
  if (ssh) return ssh[1];
  // https://github.com/owner/repo(/...)
  const https = s.match(/github\.com[/:]([^/]+\/[^/]+)/);
  if (https) return https[1].replace(/\/$/, "");
  // already owner/repo
  if (/^[^/\s]+\/[^/\s]+$/.test(s)) return s;
  return null;
}
