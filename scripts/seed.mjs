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
    `CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, author_login TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', text TEXT, metric TEXT, value REAL, delta REAL, experiment TEXT, tags TEXT, branch TEXT, commit_sha TEXT, verified INTEGER NOT NULL DEFAULT 0, meta TEXT, created_at INTEGER NOT NULL)`,
    `CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(note_id UNINDEXED, text)`,
  ],
  "write",
);
try { await c.execute(`ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT ''`); } catch { /* exists */ }

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

// [repo, title, body|null, metric|null, value|null, delta|null, experiment|null, tags|null, verified, daysAgo]
const notes = [
  ["acme-ai/rag-pipeline", "Chunk size 512 raises retrieval accuracy vs 256",
    "Re-ran the eval suite with chunk_size=512 (overlap 64). Accuracy on the 200-question gold set went from 0.89 → 0.92. Indexing time +18%, which is acceptable. Next: check if 768 keeps the gain.",
    "accuracy", 0.92, 0.03, "rag-chunking", ["rag"], 1, 1],
  ["acme-ai/rag-pipeline", "Chunk size 256 baseline", null, "accuracy", 0.89, null, "rag-chunking", ["rag"], 1, 2],
  ["acme-ai/rag-pipeline", "Hybrid BM25 + dense reranking adds +5% recall, but +40ms latency",
    "Combined BM25 lexical scores with the dense retriever and reranked top-50 with a cross-encoder. Recall@10 0.76 → 0.81. Latency went up ~40ms p50 — worth it for the offline pipeline, maybe not for live search.",
    "recall", 0.81, 0.05, "reranking", ["rag", "latency"], 1, 4],
  ["acme-ai/rag-pipeline", "Cohere rerank-v3 slightly worse than local cross-encoder here", null, "recall", 0.78, -0.02, "reranking", ["rag"], 0, 5],
  ["acme-ai/rag-pipeline", "Embeddings drift after the June data refresh",
    "General observation, no metric yet: qualitative spot-checks show the new embeddings cluster legal docs differently than before the refresh. Might explain the reranking regression. Need to quantify before acting.",
    null, null, null, null, ["observation"], 0, 3],
  ["acme-ai/rag-pipeline", "Idea: try semantic chunking on long PDFs", "Park this — split on heading boundaries instead of fixed windows for the long PDF corpus.", null, null, null, null, ["idea"], 0, 6],
  ["acme-ai/vision-finetune", "LoRA rank 16 matches full finetune at 1/8 the VRAM",
    "rank=16, alpha=32 on the ViT-L backbone reaches the same F1 as full finetuning (0.94) while fitting in 11GB. This is the new default for the sweep.",
    "f1", 0.94, 0.0, "lora-sweep", ["lora"], 1, 2],
  ["acme-ai/vision-finetune", "LoRA rank 8 drops F1 by 2 points", null, "f1", 0.92, -0.02, "lora-sweep", ["lora"], 1, 3],
  ["acme-ai/vision-finetune", "Augmentation (mixup) improves robustness on OOD set",
    "Adding mixup (alpha=0.2) lifted OOD accuracy 0.65 → 0.71 with no drop on the in-distribution val set. Keep it on.",
    "ood_acc", 0.71, 0.06, "augmentation", ["robustness"], 1, 5],
  ["acme-ai/vision-finetune", "Label noise suspected in the 'defect' class",
    "Observation only: reviewing misclassified samples, several 'defect' labels look wrong. Worth a cleaning pass before trusting the next metric bump.",
    null, null, null, null, ["observation", "data"], 0, 4],
];

const stmts = [];
for (const r of repos) {
  stmts.push({ sql: `INSERT OR IGNORE INTO projects (id, repo_full_name, created_at) VALUES (?, ?, ?)`, args: [pid(r), r, now - 30 * day] });
}
for (const [repo, title, text, metric, value, delta, exp, tags, verified, ago] of notes) {
  const nid = id("note");
  const sha = Array.from({ length: 40 }, (_, i) => "0123456789abcdef"[(i * 7 + nid.length) % 16]).join("");
  stmts.push({
    sql: `INSERT INTO notes (id, project_id, author_login, title, text, metric, value, delta, experiment, tags, branch, commit_sha, verified, meta, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [nid, pid(repo), login, title, text, metric, value, delta, exp, tags ? JSON.stringify(tags) : null, "main", sha, verified, null, now - ago * day],
  });
  stmts.push({ sql: `INSERT INTO notes_fts (note_id, text) VALUES (?, ?)`, args: [nid, `${title}\n${text ?? ""}`] });
}
stmts.push({
  sql: `INSERT INTO users (login, name, avatar_url, github_token, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(login) DO UPDATE SET updated_at = excluded.updated_at`,
  args: [login, login, null, "dev-token", now],
});

await c.batch(stmts, "write");
console.log(`Seeded ${notes.length} notes across ${repos.length} projects for @${login}.`);
