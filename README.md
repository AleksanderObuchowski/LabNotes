# LabNotes

Minimal, elegant experiment-notes for AI researchers. Capture evidence-based
findings — *"X raises accuracy by Y%"* — tied to the branch, commit and date they
happened on. Built equally for **humans** (web UI) and **LLMs** (REST API + CLI),
so experiments run by Claude Code and agents don't slip away.

- **Project = GitHub repo.** Auth and write-permissions are inherited from GitHub.
- **Source of truth:** libSQL/Turso (fast, lightweight). Git metadata is captured
  per note and softly verified against GitHub (`verified` / `unverified`).
- Compatible with [deeep-autoresearch](https://github.com/AleksanderObuchowski/deeep-autoresearch):
  agents log via the API and read prior evidence via the markdown digest.

## Stack

Next.js 16 (App Router) · Auth.js (GitHub OAuth) · libSQL/Turso · shadcn/ui ·
deploys to Vercel.

## Run locally

1. Create a GitHub OAuth App (callback `http://localhost:3000/api/auth/callback/github`).
2. Copy env and fill credentials:
   ```bash
   cp .env.example .env.local
   # set AUTH_SECRET (openssl rand -base64 32), AUTH_GITHUB_ID, AUTH_GITHUB_SECRET
   ```
   With no `TURSO_*` set, a local file DB (`.labnotes.db`) is used automatically.
3. `npm install && npm run dev` → http://localhost:3000

## REST API (`/api/v1`)

Auth: a browser session **or** `Authorization: Bearer <api-token>` (create tokens
in Settings). Write requires push-access to the repo; reads require visibility.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/notes` | Body `{repo, text, metric?, value?, delta?, experiment?, tags?, branch?, commit?, meta?}` |
| `GET` | `/notes?project=owner/repo` | Filters: `q, metric, experiment, tag, verified`; shaping: `fields=`, `format=table`, `limit`, `cursor` |
| `GET` | `/digest?project=owner/repo` | Compact **markdown** findings — default read path for agents |
| `GET` | `/projects` | Projects you can see, with note counts |
| `GET`/`POST` | `/tokens`, `DELETE /tokens/:id` | Manage API tokens |

## CLI & Claude Code skill

See [`packages/cli`](packages/cli) (the `labnotes` command) and
[`packages/skill`](packages/skill) (the THINK→TEST→**LOG** skill + reminder hook).

```bash
export LABNOTES_URL=http://localhost:3000
export LABNOTES_TOKEN=lnk_…
labnotes add "chunk 512 → +3% acc" --metric accuracy --delta 0.03 --experiment rag-chunking
labnotes digest
```
