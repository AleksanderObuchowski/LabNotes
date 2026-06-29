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
> Notes come in three linked kinds — research (a hypothesis distilled from the
> literature), devlog (the intent behind a code change), and finding (a measured
> result, "X raises accuracy by Y%") — each tied to the git branch, commit and
> date it happened on, so experiments run by agents don't slip away. Notes link
> to each other (a finding CONFIRMS a research hypothesis; a devlog SATISFIES it),
> making the full THINK -> RESEARCH -> TEST -> REFLECT trail reconstructable.
> Built for both humans (web UI) and LLMs (this REST API). A project is a GitHub
> repository; permissions are inherited from GitHub.

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

- kind        string, optional, default "finding". One of "finding" | "research"
              | "devlog". Picks which structured fields below apply.
- title       string, REQUIRED. The short headline / claim / change.
- text        string, optional. Longer details in markdown (context, how you
              measured, caveats). Rendered as markdown in the UI.
- experiment  string, optional. Threads related notes together, e.g. "rag-chunking".
              Use the SAME experiment across a research/devlog/finding trail.
- tags        string[], optional. e.g. ["rag","idea","observation"].
- branch      string, optional. Auto-captured by the CLI from local git.
- commit      string, optional. Commit SHA; if it exists on GitHub the note is
              flagged "verified", otherwise "unverified" (still stored).
- refs        array, optional. Typed links to other notes: [{ "rel": "...",
              "id": "<noteId>" }]. rel is one of confirms | refutes | satisfies
              | related. e.g. a finding [{rel:"confirms",id:<researchId>}].
- meta        object, optional. Free-form JSON; also carries the kind-specific
              structured fields below. For deeep-autoresearch you may also put
              { "role": "objective"|"guard"|"tripwire", "source": "<url>" } here.

Per-kind structured fields (inside meta):
- finding  : metric (string, e.g. "accuracy"), value (number), delta (number).
             OMIT metric for a plain observation. These are top-level body fields,
             not under meta. CONFIRMS/REFUTES a research hypothesis via refs.
- research : meta.query (string), meta.tool ("arxiv"|"semantic"|"github"|…),
             meta.sources (string[] of citations). title = the distilled claim.
- devlog   : meta.why, meta.approach, meta.alternative (strings). commit = the SHA
             it describes. SATISFIES a research hypothesis / finding via refs.

A note needs ONLY a title (and defaults to kind "finding"). Everything else is optional.

## Endpoints (base: ${base})

### Read prior notes (do this FIRST), token-efficient markdown digest
GET ${base}/api/v1/digest?project=<owner>/<repo>
  Optional: &experiment=<name>  &metric=<name>  &kind=finding|research|devlog
  Returns compact markdown grouped by experiment, each note tagged by kind with
  its links shown. PREFER THIS over raw JSON for loading context.

### Log a note (finding | research | devlog)
POST ${base}/api/v1/notes
  Content-Type: application/json
  Finding:  { "repo": "<owner>/<repo>", "kind": "finding", "title": "...",
              "text": "...", "metric": "accuracy", "value": 0.92, "delta": 0.03,
              "experiment": "rag-chunking", "tags": ["rag"],
              "branch": "main", "commit": "<sha>",
              "refs": [{ "rel": "confirms", "id": "<researchNoteId>" }] }
  Research: { "repo": "<owner>/<repo>", "kind": "research", "title": "Larger chunks
              should raise accuracy on long docs", "experiment": "rag-chunking",
              "meta": { "query": "optimal chunk size RAG", "tool": "arxiv",
                        "sources": ["arXiv:2310.xxxxx"] } }
  Devlog:   { "repo": "<owner>/<repo>", "kind": "devlog", "title": "Switch chunker
              to 512-token windows", "experiment": "rag-chunking", "commit": "<sha>",
              "meta": { "why": "...", "approach": "...", "alternative": "..." },
              "refs": [{ "rel": "satisfies", "id": "<researchNoteId>" }] }
  Returns 201 with the created note (incl. "id" and, for findings, "verified").

### Query notes as JSON (for programmatic use)
GET ${base}/api/v1/notes?project=<owner>/<repo>
  Filters:  &q=<fulltext>  &kind=finding|research|devlog  &metric=<name>
            &experiment=<name>  &tag=<name>  &verified=true|false
  Shaping:  &fields=kind,title,metric,delta,refs   (trim returned keys)
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

    labnotes digest                                   # read prior notes first

    # research: log the hypothesis and where it came from (prints a note id)
    labnotes research "Larger chunks should raise accuracy on long docs" \\
      --query "optimal chunk size RAG" --tool arxiv \\
      --source "arXiv:2310.xxxxx" --experiment rag-chunking

    # devlog: log the intent of the change, link it to the hypothesis
    labnotes devlog "Switch chunker to 512-token windows" \\
      --why "Test the chunk-size hypothesis" --approach "chunk_size 256->512" \\
      --experiment rag-chunking --satisfies <researchId>

    # finding: log the measured result, confirm/refute the hypothesis
    labnotes add "Chunk 512 raises accuracy ~3%" \\
      --body "Re-ran eval; 0.89 -> 0.92. Indexing +18%." \\
      --metric accuracy --value 0.92 --delta 0.03 \\
      --experiment rag-chunking --confirms <researchId>

## Recommended agent loop

1. \`labnotes digest\` (or GET /api/v1/digest) — load existing evidence + open hypotheses.
2. RESEARCH: if you consult the literature, log a \`research\` note with query/tool/sources.
3. TEST: make ONE change; before/at commit time, log a \`devlog\` (why/approach/alternative)
   and link it \`--satisfies\` the research hypothesis. Commit the code first.
4. REFLECT: measure it, then log a \`finding\` with metric/delta and link it
   \`--confirms\` or \`--refutes\` the hypothesis. Keep them all on one --experiment.
5. Repeat. Log surprising/negative/null results too — they are evidence.
`;

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
