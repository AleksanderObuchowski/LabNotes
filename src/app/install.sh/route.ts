import { headers } from "next/headers";

// One-line installer: `curl -fsSL <base>/install.sh | sh`
// Installs the labnotes CLI plus the Claude Code skill and reminder hook.
export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;

  const script = `#!/bin/sh
# LabNotes installer — CLI + Claude Code skill + reminder hook
set -e

BASE="\${LABNOTES_URL:-${base}}"
BIN="\${LABNOTES_BIN:-$HOME/.local/bin}"
SKILL_DIR="$HOME/.claude/skills/labnotes"

echo "Installing LabNotes from $BASE"
mkdir -p "$BIN" "$SKILL_DIR/hooks"

echo "  • CLI    -> $BIN/labnotes"
curl -fsSL "$BASE/install/cli" -o "$BIN/labnotes"
chmod +x "$BIN/labnotes"

echo "  • skill  -> $SKILL_DIR/SKILL.md"
curl -fsSL "$BASE/install/skill" -o "$SKILL_DIR/SKILL.md"

echo "  • hook   -> $SKILL_DIR/hooks/labnotes-reminder.mjs"
curl -fsSL "$BASE/install/hook" -o "$SKILL_DIR/hooks/labnotes-reminder.mjs"

echo ""
echo "Done. Next steps:"
echo "  1. Add the CLI to your PATH (if it isn't already):"
echo "       export PATH=\\"$BIN:\\$PATH\\""
echo "  2. Point it at this server and your token:"
echo "       export LABNOTES_URL=$BASE"
echo "       export LABNOTES_TOKEN=<create one at $BASE/settings>"
echo "  3. From inside a git repo:"
echo "       labnotes digest          # read prior findings"
echo "       labnotes add \\"my finding\\" --metric accuracy --delta 0.03"
echo ""
echo "Optional — enable the reminder hook in .claude/settings.json (see $BASE/setup)."
`;

  return new Response(script, {
    status: 200,
    headers: { "Content-Type": "text/x-shellscript; charset=utf-8" },
  });
}
