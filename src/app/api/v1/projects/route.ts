import { resolveActor } from "@/lib/actor";
import { hasReadAccess } from "@/lib/github";
import { apiError, json } from "@/lib/http";
import { listProjects } from "@/lib/notes";

export async function GET(req: Request) {
  const actor = await resolveActor(req);
  if (!actor) return apiError("Unauthorized", 401);

  const all = await listProjects();
  // Only surface projects the user can actually see on GitHub.
  const checks = await Promise.all(
    all.map((p) => hasReadAccess(actor.githubToken, p.repo_full_name)),
  );
  const visible = all.filter((_, i) => checks[i]);

  return json({ projects: visible });
}
