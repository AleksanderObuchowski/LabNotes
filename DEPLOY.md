# Deploying LabNotes on Railway

LabNotes is a standard Next.js app; Railway builds it with Nixpacks
(`npm install` → `npm run build` → `npm run start`). `next start` binds to
Railway's `$PORT` automatically.

## Required environment variables (Railway → Variables)

| Variable | Notes |
| --- | --- |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_GITHUB_ID` | GitHub OAuth App client id |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App client secret |
| `AUTH_TRUST_HOST` | `true` (required for Auth.js behind Railway's proxy) |
| `TURSO_DATABASE_URL` | Turso libSQL URL (recommended for persistence) |
| `TURSO_AUTH_TOKEN` | Turso token |

Without `TURSO_*` the app uses a local file DB, which does **not** persist across
Railway redeploys — set up a free Turso DB (`turso db create labnotes`) for real use.

## GitHub OAuth App

Create one at https://github.com/settings/developers with:

- Homepage URL: `https://<your-app>.up.railway.app`
- Authorization callback URL: `https://<your-app>.up.railway.app/api/auth/callback/github`

Put the client id/secret into the Railway variables above. After the first deploy
you'll know the domain — set it on the OAuth app and in `AUTH_GITHUB_*`, then
redeploy.
