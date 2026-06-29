import { headers } from "next/headers";

// Public, unauthenticated guide for LLMs/agents on how to use LabNotes.
// Convention: https://llmstxt.org
export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;

  const body = `# LabNotes

> LabNotes is the durable, evidence-based memory for experiments in a code repo.
> Each note records a finding or observation ("X raises accuracy by Y%") tied to
> the git branch, commit and date it happened on, so experiments run by agents
> don't slip away. Built for both humans (web UI) and LLMs (this REST API).
> A project is a GitHub repository; permissions are inherited from GitHub.

## Core principle for agents

Before starting or resuming experiment work in a repo, READ the existing findings
so you don't repeat experiments or contradict known results. After every change
that affects a measurable result — or any noteworthy observation — LOG it
immediately, before moving on. Quote real numbers. Negative and null results are
evidence too: log them.

## Authentication

All API calls require a per-user bearer token:

    Authorization: Bearer lnk_xxx

A human creates the token in the web UI at ${base}/settings (one per agent/machine)
and provides it to you. Write access requires push permission to the repo on
GitHub; read access requires repo visibility. Both are checked live against GitHub.

## The note model

- title       string, REQUIRED. The short headline of the finding/observation.
- text        string, optional. Longer details in markdown (context, how you
              measured, caveats). Rendered as markdown in the UI.
- metric      string, optional. e.g. "accuracy". OMIT for general observations.
- value       number, optional. Absolute value, e.g. 0.92.
- delta       number, optional. Change vs baseline, e.g. 0.03 or -0.02.
- experiment  string, optional. Threads related notes together, e.g. "rag-chunking".
- tags        string[], optional. e.g. ["rag","idea","observation"].
- branch      string, optional. Auto-captured by the CLI from local git.
- commit      string, optional. Commit SHA; if it exists on GitHub the note is
              flagged "verified", otherwise "unverified" (still stored).
- meta        object, optional. Free-form JSON. For deeep-autoresearch, put
              { "role": "objective"|"guard"|"tripwire", "source": "<url>" } here.

A note needs ONLY a title. Metrics are optional — a note can be a plain observation.

## Endpoints (base: ${base})

### Read prior findings (do this FIRST), token-efficient markdown digest
GET ${base}/api/v1/digest?project=<owner>/<repo>
  Optional: &experiment=<name>  &metric=<name>
  Returns compact markdown grouped by experiment. PREFER THIS over raw JSON for
  loading context — it avoids repeated JSON keys.

### Log a finding
POST ${base}/api/v1/notes
  Content-Type: application/json
  Body: { "repo": "<owner>/<repo>", "title": "...", "text": "...",
          "metric": "accuracy", "value": 0.92, "delta": 0.03,
          "experiment": "rag-chunking", "tags": ["rag"],
          "branch": "main", "commit": "<sha>" }
  Returns 201 with the created note (incl. "verified": true|false).

### Query findings as JSON (for programmatic use)
GET ${base}/api/v1/notes?project=<owner>/<repo>
  Filters:  &q=<fulltext>  &metric=<name>  &experiment=<name>  &tag=<name>
            &verified=true|false
  Shaping:  &fields=title,metric,delta,verified   (trim returned keys)
            &format=table   (returns { columns, rows } — least tokens for bulk)
            &limit=<n>  &cursor=<created_at>   (keyset pagination)

### List your projects
GET ${base}/api/v1/projects
  Returns projects you can see on GitHub, with note counts.

### Manage tokens (usually done by a human in the UI)
GET ${base}/api/v1/tokens
POST ${base}/api/v1/tokens          Body: { "name": "claude-code" }  -> token shown once
DELETE ${base}/api/v1/tokens/<id>

## CLI (recommended for agents working inside a git repo)

The \`labnotes\` CLI auto-detects repo/branch/commit from local git:

    export LABNOTES_URL=${base}
    export LABNOTES_TOKEN=lnk_xxx

    labnotes digest                                   # read prior findings first
    labnotes add "Chunk 512 raises accuracy ~3%" \\
      --body "Re-ran eval; 0.89 -> 0.92. Indexing +18%." \\
      --metric accuracy --value 0.92 --delta 0.03 --experiment rag-chunking
    labnotes add "Embeddings drift after June refresh" --tag observation

## Recommended agent loop

1. \`GET /api/v1/digest?project=<repo>\` (or \`labnotes digest\`) — load evidence.
2. Make ONE change; measure it against a metric.
3. Commit the code first (so the finding can be verified).
4. Log the finding with its metric/delta and a markdown \`text\` body.
5. Repeat. Log surprising/negative results too. Park ideas with --tag idea.
`;

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
