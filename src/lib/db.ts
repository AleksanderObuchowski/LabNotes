import { createClient, type Client } from "@libsql/client";

// libSQL/Turso client. Uses the hosted DB when TURSO_DATABASE_URL is set,
// otherwise falls back to a local file so the app runs with zero config.
let _client: Client | null = null;

export function db(): Client {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL ?? "file:.labnotes.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  _client = createClient({ url, authToken });
  return _client;
}

// Schema is created lazily on first access and memoised for the process.
let _ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (_ready) return _ready;
  _ready = (async () => {
    const c = db();
    await c.batch(
      [
        `CREATE TABLE IF NOT EXISTS users (
          login TEXT PRIMARY KEY,
          name TEXT,
          avatar_url TEXT,
          github_token TEXT,
          updated_at INTEGER NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          repo_full_name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          author_login TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          text TEXT,
          metric TEXT,
          value REAL,
          delta REAL,
          experiment TEXT,
          tags TEXT,
          branch TEXT,
          commit_sha TEXT,
          verified INTEGER NOT NULL DEFAULT 0,
          meta TEXT,
          created_at INTEGER NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_notes_project_created
           ON notes(project_id, created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_notes_project_experiment
           ON notes(project_id, experiment)`,
        `CREATE INDEX IF NOT EXISTS idx_notes_project_metric
           ON notes(project_id, metric)`,
        `CREATE TABLE IF NOT EXISTS api_tokens (
          id TEXT PRIMARY KEY,
          user_login TEXT NOT NULL,
          name TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          token_prefix TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          last_used_at INTEGER
        )`,
        `CREATE INDEX IF NOT EXISTS idx_tokens_user ON api_tokens(user_login)`,
        // Standalone FTS index (notes are append-only, so we only ever insert).
        `CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts
           USING fts5(note_id UNINDEXED, text)`,
      ],
      "write",
    );
    // Migration for DBs created before `title` existed (ignore if present).
    try {
      await c.execute(`ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT ''`);
    } catch {
      /* column already exists */
    }
  })();
  return _ready;
}
