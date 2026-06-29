import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, FileText, FlaskConical, FolderGit2, ChevronRight } from "lucide-react";
import { sessionActor } from "@/lib/actor";
import { hasReadAccess } from "@/lib/github";
import { listProjects, statsForProjects } from "@/lib/notes";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";

export default async function ProjectsPage() {
  const actor = await sessionActor();
  if (!actor) redirect("/");

  const all = await listProjects();
  const checks = await Promise.all(
    all.map((p) => hasReadAccess(actor.githubToken, p.repo_full_name)),
  );
  const projects = all.filter((_, i) => checks[i]);
  const stats = await statsForProjects(projects.map((p) => p.id));
  const verifiedPct = stats.notes ? Math.round((stats.verified / stats.notes) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Your experiment findings across {projects.length} project
          {projects.length === 1 ? "" : "s"}.
        </p>
      </div>

      {projects.length === 0 ? (
        <Empty className="rounded-xl border">
          <EmptyHeader>
            <EmptyTitle>No findings yet</EmptyTitle>
            <EmptyDescription>
              Log your first finding from a repo with the <code>labnotes</code> CLI or
              the REST API, and the project appears here automatically.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <code className="rounded bg-muted px-2 py-1 text-xs">
              labnotes add &quot;chunk 512 → +3% acc&quot; --metric accuracy --delta 0.03
            </code>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Projects" value={projects.length} icon={FolderGit2} hint="Repos with findings" />
            <StatCard label="Findings" value={stats.notes} icon={FileText} hint="Logged across all projects" />
            <StatCard label="Verified" value={`${verifiedPct}%`} icon={CheckCircle2} hint={`${stats.verified} of ${stats.notes} findings`} />
            <StatCard label="Experiments" value={stats.experiments} icon={FlaskConical} hint="Distinct experiment threads" />
          </div>

          <div className="rounded-xl border bg-card">
            <div className="border-b p-4">
              <h2 className="text-sm font-medium">Projects</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Repository</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer">
                    <TableCell className="p-0">
                      <Link href={`/p/${p.repo_full_name}`} className="flex items-center gap-2 px-4 py-3 font-medium">
                        <FolderGit2 className="size-4 text-muted-foreground" />
                        {p.repo_full_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p.note_count ?? 0}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.last_at ? new Date(p.last_at).toISOString().slice(0, 10) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
