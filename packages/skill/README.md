# LabNotes — Claude Code skill & hook

Makes evidence-based experiment logging a reflex for agents working in a repo.

## Install the skill

Copy the skill into your Claude Code skills directory:

```bash
cp -r labnotes ~/.claude/skills/labnotes
```

Claude will auto-trigger it when you change a measurable result or start
optimization work. It pulls prior findings (`labnotes digest`) before acting and
logs each result (`labnotes add ...`).

## Install the CLI

```bash
npm install -g ../cli           # exposes the `labnotes` command
export LABNOTES_URL=https://your-labnotes-deployment
export LABNOTES_TOKEN=lnk_...    # from Settings → API tokens
```

## Install the reminder hook (optional but recommended)

This is where enforcement lives — a Stop hook that nudges you to log a finding
after committing experiment work. Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/skills/labnotes/hooks/labnotes-reminder.mjs"
          }
        ]
      }
    ]
  }
}
```

(Adjust the path to wherever you copied `hooks/labnotes-reminder.mjs`.)
