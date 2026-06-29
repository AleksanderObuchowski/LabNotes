#!/usr/bin/env node
// LabNotes Stop hook — nudges the agent to log a finding when it just committed
// experiment work but may not have recorded the result. Conservative by design:
// only fires when HEAD moved recently, and never blocks.
//
// Wire it up in .claude/settings.json (see ../README.md).

import { execSync } from "node:child_process";

function git(args) {
  try {
    return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
}

// Read (and ignore) hook payload on stdin so the process doesn't hang.
try {
  await new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", resolve);
    process.stdin.on("error", resolve);
    setTimeout(resolve, 50);
  });
} catch {
  /* ignore */
}

const lastCommitEpoch = Number(git("log -1 --format=%ct") ?? 0);
const minutesSinceCommit = (Date.now() / 1000 - lastCommitEpoch) / 60;

// Only nudge if there was a commit in the last ~30 minutes.
if (lastCommitEpoch && minutesSinceCommit < 30) {
  const reason =
    "Reminder: if this commit changed a measurable result, log it to LabNotes so " +
    "the experiment isn't lost — e.g. `labnotes add \"<finding>\" --metric <m> --delta <d> --experiment <e>`. " +
    "Run `labnotes digest` to review prior findings.";
  // Non-blocking: surface as context without forcing continuation.
  process.stdout.write(JSON.stringify({ systemMessage: reason }));
}

process.exit(0);
