import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Serves the raw CLI / skill / hook files (bundled in the repo) so the installer
// and humans can fetch them directly from this deployment.
const ASSETS: Record<string, { path: string; type: string }> = {
  cli: { path: "packages/cli/labnotes.mjs", type: "text/plain; charset=utf-8" },
  skill: { path: "packages/skill/labnotes/SKILL.md", type: "text/markdown; charset=utf-8" },
  hook: { path: "packages/skill/hooks/labnotes-reminder.mjs", type: "text/plain; charset=utf-8" },
};

export async function GET(_req: Request, ctx: { params: Promise<{ asset: string }> }) {
  const { asset } = await ctx.params;
  const meta = ASSETS[asset];
  if (!meta) return new Response("Not found", { status: 404 });
  try {
    const content = await readFile(join(process.cwd(), meta.path), "utf8");
    return new Response(content, { status: 200, headers: { "Content-Type": meta.type } });
  } catch {
    return new Response("Asset unavailable", { status: 500 });
  }
}
