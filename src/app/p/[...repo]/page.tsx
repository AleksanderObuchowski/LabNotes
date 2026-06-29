import { redirect } from "next/navigation";
import { sessionActor } from "@/lib/actor";
import { hasPushAccess, hasReadAccess, normalizeRepo } from "@/lib/github";
import { listNotes } from "@/lib/notes";
import { ProjectFeed } from "@/components/project-feed";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ repo: string[] }>;
}) {
  const actor = await sessionActor();
  if (!actor) redirect("/");

  const { repo } = await params;
  const repoFullName = normalizeRepo(repo.join("/"));
  if (!repoFullName) redirect("/projects");

  if (!(await hasReadAccess(actor.githubToken, repoFullName))) {
    return (
      <Empty className="border rounded-lg">
        <EmptyHeader>
          <EmptyTitle>No access</EmptyTitle>
          <EmptyDescription>
            You don&apos;t have access to <code>{repoFullName}</code> on GitHub.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const [notes, canWrite] = await Promise.all([
    listNotes({ repoFullName, limit: 200 }),
    hasPushAccess(actor.githubToken, repoFullName),
  ]);

  return <ProjectFeed repo={repoFullName} notes={notes} canWrite={canWrite} />;
}
