import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signInWithGitHub } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/projects");

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyTitle className="text-2xl">LabNotes</EmptyTitle>
          <EmptyDescription>
            Capture evidence-based experiment findings — &ldquo;X raises accuracy by
            Y%&rdquo; — tied to the branch, commit and date they happened on. Built
            for humans and for the LLMs running your experiments.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <form action={signInWithGitHub}>
            <Button type="submit" size="lg">
              Continue with GitHub
            </Button>
          </form>
        </EmptyContent>
      </Empty>
    </div>
  );
}
