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

async function cmdAdd(argv) {
  requireToken();
  const { flags, positional } = parseArgs(argv);
  const title = (positional.join(" ").trim() || flags.title || "").trim();
  if (!title) {
    console.error('Usage: labnotes add "<title>" [--body "longer text"] [--metric m --value v --delta d --experiment e --tag t]');
    process.exit(1);
  }
  const text = flags.body ?? flags.text ?? flags.details;

  const repo = flags.repo ?? detectRepo();
  if (!repo) {
    console.error("Error: could not detect a GitHub repo. Pass --repo owner/name.");
    process.exit(1);
  }
  const branch = flags.branch ?? git("rev-parse --abbrev-ref HEAD") ?? undefined;
  const commit = flags.commit ?? git("rev-parse HEAD") ?? undefined;
  const tags = flags.tag ? (Array.isArray(flags.tag) ? flags.tag : [flags.tag]) : undefined;

  const body = {
    repo,
    title,
    text: text || undefined,
    metric: flags.metric,
    value: flags.value !== undefined ? Number(flags.value) : undefined,
    delta: flags.delta !== undefined ? Number(flags.delta) : undefined,
    experiment: flags.experiment,
    tags,
    branch,
    commit,
  };

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
  console.log(`✓ logged to ${repo}${note.verified ? " (verified)" : " (unverified)"} — ${note.id}`);
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

Usage:
  labnotes add "<title>" [options]      Log a finding/observation (auto-detects repo/branch/commit)
  labnotes digest [--project owner/repo] Print this project's findings as markdown

Options for add:
  --body <text>        longer details (optional)
  --metric <name>      e.g. accuracy (optional)
  --value <number>     absolute value, e.g. 0.92
  --delta <number>     change, e.g. 0.03
  --experiment <name>  groups related findings
  --tag <name>         repeatable
  --repo <owner/name>  override repo detection

Env:
  LABNOTES_URL   default http://localhost:3000
  LABNOTES_TOKEN required — create one in Settings`);
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case "add":
    await cmdAdd(rest);
    break;
  case "digest":
    await cmdDigest(rest);
    break;
  default:
    usage();
}
