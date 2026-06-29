// Demo seed for local dev. Inserts a user, two projects and sample findings
// into the local libSQL file DB. Run: node scripts/seed.mjs
import { createClient } from "@libsql/client";

const c = createClient({ url: process.env.TURSO_DATABASE_URL ?? "file:.labnotes.db" });
const login = process.env.LABNOTES_DEV_LOGIN ?? "demo-user";
const now = Date.now();
const day = 86_400_000;
let n = 0;
const id = (p) => `${p}_${(++n).toString().padStart(3, "0")}`;

await c.batch(
  [
    `CREATE TABLE IF NOT EXISTS users (login TEXT PRIMARY KEY, name TEXT, avatar_url TEXT, github_token TEXT, updated_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, repo_full_name TEXT NOT NULL, created_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, author_login TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'finding', title TEXT NOT NULL DEFAULT '', text TEXT, metric TEXT, value REAL, delta REAL, experiment TEXT, tags TEXT, branch TEXT, commit_sha TEXT, verified INTEGER NOT NULL DEFAULT 0, refs TEXT, meta TEXT, created_at INTEGER NOT NULL)`,
    `CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(note_id UNINDEXED, text)`,
  ],
  "write",
);
try { await c.execute(`ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT ''`); } catch { /* exists */ }
try { await c.execute(`ALTER TABLE notes ADD COLUMN kind TEXT NOT NULL DEFAULT 'finding'`); } catch { /* exists */ }
try { await c.execute(`ALTER TABLE notes ADD COLUMN refs TEXT`); } catch { /* exists */ }

const repos = ["acme-ai/rag-pipeline", "acme-ai/vision-finetune"];
const pid = (r) => `github.com/${r}`;

// Fresh start so re-running doesn't duplicate or leave title-less rows.
await c.batch(
  [
    `DELETE FROM notes WHERE project_id IN ('${pid(repos[0])}','${pid(repos[1])}')`,
    `DELETE FROM notes_fts`,
  ],
  "write",
);

// Stable ids let notes link to each other via `refs`.
const RID = "note_rag_chunk_research"; // research hypothesis
const DID = "note_rag_chunk_devlog";   // devlog satisfying it
// Notes carry an explicit `kind` and optional `meta`/`refs`. Defaults: finding, no links.
const notes = [
  // --- A full linked thread: research hypothesis → devlog → finding ---
  { id: RID, repo: "acme-ai/rag-pipeline", kind: "research",
    title: "Larger chunks should raise retrieval accuracy on long-form docs",
    text: "Distilled from the retrieval literature: fixed-window chunking at 256 tokens fragments arguments that span paragraphs, hurting recall on long-form QA. Several papers report monotonic gains up to ~512 tokens before precision starts to suffer.",
    exp: "rag-chunking", tags: ["rag", "hypothesis"], verified: 0, ago: 3,
    meta: { query: "optimal chunk size retrieval augmented generation long documents", tool: "arxiv", sources: ["arXiv:2310.xxxxx (Chunk size ablations)", "arXiv:2307.yyyyy (Long-context RAG)"] } },
  { id: DID, repo: "acme-ai/rag-pipeline", kind: "devlog",
    title: "Switch chunker to 512-token windows with 64 overlap",
    text: null, exp: "rag-chunking", tags: ["rag"], verified: 1, ago: 2,
    refs: [{ rel: "satisfies", id: RID }],
    meta: { why: "Test the hypothesis that 512-token chunks beat the 256 baseline on retrieval accuracy.", approach: "Changed splitter.chunk_size 256→512 and overlap 32→64; re-built the index. Intent only — see commit for the diff.", alternative: "Semantic/heading-based chunking (deferred — bigger change, parked for the long-PDF corpus)." } },
  { repo: "acme-ai/rag-pipeline", kind: "finding",
    title: "Chunk size 512 raises retrieval accuracy vs 256",
    text: "Re-ran the eval suite with chunk_size=512 (overlap 64). Accuracy on the 200-question gold set went from 0.89 → 0.92. Indexing time +18%, which is acceptable. Next: check if 768 keeps the gain.",
    metric: "accuracy", value: 0.92, delta: 0.03, exp: "rag-chunking", tags: ["rag"], verified: 1, ago: 1,
    refs: [{ rel: "confirms", id: RID }] },
  { repo: "acme-ai/rag-pipeline", kind: "finding", title: "Chunk size 256 baseline", metric: "accuracy", value: 0.89, exp: "rag-chunking", tags: ["rag"], verified: 1, ago: 2 },

  { repo: "acme-ai/rag-pipeline", kind: "finding",
    title: "Hybrid BM25 + dense reranking adds +5% recall, but +40ms latency",
    text: "Combined BM25 lexical scores with the dense retriever and reranked top-50 with a cross-encoder. Recall@10 0.76 → 0.81. Latency went up ~40ms p50 — worth it for the offline pipeline, maybe not for live search.",
    metric: "recall", value: 0.81, delta: 0.05, exp: "reranking", tags: ["rag", "latency"], verified: 1, ago: 4 },
  { repo: "acme-ai/rag-pipeline", kind: "finding", title: "Cohere rerank-v3 slightly worse than local cross-encoder here", metric: "recall", value: 0.78, delta: -0.02, exp: "reranking", tags: ["rag"], verified: 0, ago: 5 },
  { repo: "acme-ai/rag-pipeline", kind: "finding", title: "Embeddings drift after the June data refresh",
    text: "General observation, no metric yet: qualitative spot-checks show the new embeddings cluster legal docs differently than before the refresh. Might explain the reranking regression. Need to quantify before acting.",
    exp: null, tags: ["observation"], verified: 0, ago: 3 },
  { repo: "acme-ai/rag-pipeline", kind: "finding", title: "Idea: try semantic chunking on long PDFs", text: "Park this — split on heading boundaries instead of fixed windows for the long PDF corpus.", tags: ["idea"], verified: 0, ago: 6 },

  { repo: "acme-ai/vision-finetune", kind: "finding", title: "LoRA rank 16 matches full finetune at 1/8 the VRAM",
    text: "rank=16, alpha=32 on the ViT-L backbone reaches the same F1 as full finetuning (0.94) while fitting in 11GB. This is the new default for the sweep.",
    metric: "f1", value: 0.94, delta: 0.0, exp: "lora-sweep", tags: ["lora"], verified: 1, ago: 2 },
  { repo: "acme-ai/vision-finetune", kind: "finding", title: "LoRA rank 8 drops F1 by 2 points", metric: "f1", value: 0.92, delta: -0.02, exp: "lora-sweep", tags: ["lora"], verified: 1, ago: 3 },
  { repo: "acme-ai/vision-finetune", kind: "finding", title: "Augmentation (mixup) improves robustness on OOD set",
    text: "Adding mixup (alpha=0.2) lifted OOD accuracy 0.65 → 0.71 with no drop on the in-distribution val set. Keep it on.",
    metric: "ood_acc", value: 0.71, delta: 0.06, exp: "augmentation", tags: ["robustness"], verified: 1, ago: 5 },
  { repo: "acme-ai/vision-finetune", kind: "finding", title: "Label noise suspected in the 'defect' class",
    text: "Observation only: reviewing misclassified samples, several 'defect' labels look wrong. Worth a cleaning pass before trusting the next metric bump.",
    exp: null, tags: ["observation", "data"], verified: 0, ago: 4 },
];

const stmts = [];
for (const r of repos) {
  stmts.push({ sql: `INSERT OR IGNORE INTO projects (id, repo_full_name, created_at) VALUES (?, ?, ?)`, args: [pid(r), r, now - 30 * day] });
}
for (const o of notes) {
  const nid = o.id ?? id("note");
  const sha = Array.from({ length: 40 }, (_, i) => "0123456789abcdef"[(i * 7 + nid.length) % 16]).join("");
  const tags = o.tags && o.tags.length ? JSON.stringify(o.tags) : null;
  const refs = o.refs && o.refs.length ? JSON.stringify(o.refs) : null;
  const meta = o.meta ? JSON.stringify(o.meta) : null;
  // Research notes aren't tied to a commit; findings/devlogs are.
  const branch = o.kind === "research" ? null : "main";
  const commit = o.kind === "research" ? null : sha;
  stmts.push({
    sql: `INSERT INTO notes (id, project_id, author_login, kind, title, text, metric, value, delta, experiment, tags, branch, commit_sha, verified, refs, meta, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [nid, pid(o.repo), login, o.kind ?? "finding", o.title, o.text ?? null, o.metric ?? null, o.value ?? null, o.delta ?? null, o.exp ?? null, tags, branch, commit, o.verified ?? 0, refs, meta, now - (o.ago ?? 0) * day],
  });
  const ftsText = `${o.title}\n${o.text ?? ""}\n${o.meta ? Object.values(o.meta).flat().filter((v) => typeof v === "string").join(" ") : ""}`;
  stmts.push({ sql: `INSERT INTO notes_fts (note_id, text) VALUES (?, ?)`, args: [nid, ftsText] });
}
stmts.push({
  sql: `INSERT INTO users (login, name, avatar_url, github_token, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(login) DO UPDATE SET updated_at = excluded.updated_at`,
  args: [login, login, null, "dev-token", now],
});

await c.batch(stmts, "write");
console.log(`Seeded ${notes.length} notes across ${repos.length} projects for @${login}.`);
