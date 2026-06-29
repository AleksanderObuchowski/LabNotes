#!/usr/bin/env node
// labnotes — log and read evidence-based experiment findings from a git repo.
// Zero dependencies; uses Node's built-in fetch (Node 18+) and git.

import { execSync } from "node:child_process";

const BASE = (process.env.LABNOTES_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.LABNOTES_TOKEN;

function git(args) {
  try {
    return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function detectRepo() {
  const url = git("remote get-url origin");
  if (!url) return null;
  const s = url.trim().replace(/\.git$/, "");
  const ssh = s.match(/^git@github\.com:([^/]+\/[^/]+)$/);
  if (ssh) return ssh[1];
  const https = s.match(/github\.com[/:]([^/]+\/[^/]+)/);
  if (https) return https[1].replace(/\/$/, "");
  return null;
}

// Minimal flag parser: collects --key value (repeatable keys become arrays) and positionals.
function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      if (flags[key] === undefined) flags[key] = val;
      else if (Array.isArray(flags[key])) flags[key].push(val);
      else flags[key] = [flags[key], val];
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function requireToken() {
  if (!TOKEN) {
    console.error("Error: LABNOTES_TOKEN is not set. Create one in Settings and export it.");
    process.exit(1);
  }
}

const asArray = (v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

// Drop undefined values; return undefined if nothing's left (avoids empty meta {}).
function cleanMeta(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return Object.keys(out).length ? out : undefined;
}

// Collect typed cross-note links from --confirms/--refutes/--satisfies/--related <id>
// and generic --link rel:id (all repeatable).
const RELS = ["confirms", "refutes", "satisfies", "related"];
function collectRefs(flags) {
  const refs = [];
  for (const rel of RELS) {
    for (const id of asArray(flags[rel]) ?? []) refs.push({ rel, id });
  }
  for (const spec of asArray(flags.link) ?? []) {
    const [rel, id] = String(spec).split(":");
    if (RELS.includes(rel) && id) refs.push({ rel, id });
  }
  return refs.length ? refs : undefined;
}

function titleFrom(positional, flags, kind) {
  const title = (positional.join(" ").trim() || flags.title || "").trim();
  if (!title) {
    console.error(`Error: a title is required. e.g. labnotes ${kind} "<title>" …`);
    process.exit(1);
  }
  return title;
}

async function postNote(body) {
  const res = await fetch(`${BASE}/api/v1/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    console.error(`Failed (${res.status}): ${j.error ?? res.statusText}`);
    process.exit(1);
  }
  const note = await res.json();
  const flag = note.kind === "finding" ? (note.verified ? " (verified)" : " (unverified)") : "";
  console.log(`✓ ${note.kind} logged to ${body.repo}${flag} — ${note.id}`);
}

// finding (default) — a measured result/observation, tied to the current commit.
async function cmdAdd(argv) {
  requireToken();
  const { flags, positional } = parseArgs(argv);
  const title = titleFrom(positional, flags, "add");
  const repo = flags.repo ?? detectRepo();
  if (!repo) {
    console.error("Error: could not detect a GitHub repo. Pass --repo owner/name.");
    process.exit(1);
  }
  await postNote({
    repo,
    kind: "finding",
    title,
    text: flags.body ?? flags.text ?? flags.details ?? undefined,
    metric: flags.metric,
    value: flags.value !== undefined ? Number(flags.value) : undefined,
    delta: flags.delta !== undefined ? Number(flags.delta) : undefined,
    experiment: flags.experiment,
    tags: asArray(flags.tag),
    branch: flags.branch ?? git("rev-parse --abbrev-ref HEAD") ?? undefined,
    commit: flags.commit ?? git("rev-parse HEAD") ?? undefined,
    refs: collectRefs(flags),
  });
}

// research — a hypothesis/claim distilled from the literature (no commit needed).
async function cmdResearch(argv) {
  requireToken();
  const { flags, positional } = parseArgs(argv);
  const title = titleFrom(positional, flags, "research");
  const repo = flags.repo ?? detectRepo();
  if (!repo) {
    console.error("Error: could not detect a GitHub repo. Pass --repo owner/name.");
    process.exit(1);
  }
  await postNote({
    repo,
    kind: "research",
    title,
    text: flags.body ?? flags.text ?? undefined,
    experiment: flags.experiment,
    tags: asArray(flags.tag),
    meta: cleanMeta({ query: flags.query, tool: flags.tool, sources: asArray(flags.source) }),
    refs: collectRefs(flags),
  });
}

// devlog — the intent behind a code change, tied to the current commit.
async function cmdDevlog(argv) {
  requireToken();
  const { flags, positional } = parseArgs(argv);
  const title = titleFrom(positional, flags, "devlog");
  const repo = flags.repo ?? detectRepo();
  if (!repo) {
    console.error("Error: could not detect a GitHub repo. Pass --repo owner/name.");
    process.exit(1);
  }
  await postNote({
    repo,
    kind: "devlog",
    title,
    text: flags.body ?? flags.text ?? undefined,
    experiment: flags.experiment,
    tags: asArray(flags.tag),
    branch: flags.branch ?? git("rev-parse --abbrev-ref HEAD") ?? undefined,
    commit: flags.commit ?? git("rev-parse HEAD") ?? undefined,
    meta: cleanMeta({ why: flags.why, approach: flags.approach, alternative: flags.alternative }),
    refs: collectRefs(flags),
  });
}

async function cmdDigest(argv) {
  requireToken();
  const { flags } = parseArgs(argv);
  const repo = flags.project ?? flags.repo ?? detectRepo();
  if (!repo) {
    console.error("Error: could not detect a repo. Pass --project owner/name.");
    process.exit(1);
  }
  const params = new URLSearchParams({ project: repo });
  if (flags.experiment) params.set("experiment", flags.experiment);
  if (flags.metric) params.set("metric", flags.metric);

  const res = await fetch(`${BASE}/api/v1/digest?${params}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    console.error(`Failed (${res.status}): ${j.error ?? res.statusText}`);
    process.exit(1);
  }
  console.log(await res.text());
}

function usage() {
  console.log(`labnotes — evidence-based experiment notes

Three note kinds mirror the research loop (auto-detect repo/branch/commit from git):
  labnotes research "<title>" [options]  A hypothesis distilled from the literature
  labnotes devlog   "<title>" [options]  The intent behind a code change
  labnotes add      "<title>" [options]  A measured finding/observation (default)
  labnotes digest   [--project owner/repo]  Print this project's notes as markdown

Common options:
  --body <text>        longer details / markdown (optional)
  --experiment <name>  groups related notes into one thread
  --tag <name>         repeatable
  --repo <owner/name>  override repo detection

  add (finding):   --metric <name> --value <number> --delta <number>
  research:        --query <text> --tool <arxiv|semantic|github|…> --source <citation> (repeatable)
  devlog:          --why <text> --approach <text> --alternative <text>

Linking (any kind, repeatable — <id> is a note id):
  --confirms <id>  --refutes <id>  --satisfies <id>  --related <id>
  --link <rel:id>  generic form, e.g. --link confirms:abc123

  e.g.  labnotes add "Chunk 512 → +3% accuracy" --metric accuracy --delta 0.03 --confirms <researchId>

Env:
  LABNOTES_URL   default http://localhost:3000
  LABNOTES_TOKEN required — create one in Settings`);
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case "add":
    await cmdAdd(rest);
    break;
  case "research":
    await cmdResearch(rest);
    break;
  case "devlog":
    await cmdDevlog(rest);
    break;
  case "digest":
    await cmdDigest(rest);
    break;
  default:
    usage();
}
