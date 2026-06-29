import { headers } from "next/headers";
import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  KeyRound,
  Terminal,
  Sparkles,
  Bell,
  FlaskConical,
} from "lucide-react";
import { CodeBlock } from "@/components/code-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const DEEEP = "https://github.com/AleksanderObuchowski/deeep-autoresearch";

function Step({
  n,
  icon: Icon,
  title,
  children,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-sm font-medium">
          {n}
        </div>
        <div className="mt-2 w-px flex-1 bg-border" />
      </div>
      <div className="flex-1 space-y-3 pb-8">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export default async function SetupPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set up LabNotes</h1>
        <p className="text-sm text-muted-foreground">
          Get the CLI, the Claude Code skill and the reminder hook running in a couple
          of minutes — for you and for the agents running your experiments.
        </p>
      </div>

      <div>
        <Step n={1} icon={Terminal} title="Install the toolkit (one line)">
          <p className="text-sm text-muted-foreground">
            Installs the <code>labnotes</code> CLI, the Claude Code skill, and the
            reminder hook into <code>~/.claude/skills/labnotes</code>.
          </p>
          <CodeBlock code={`curl -fsSL ${base}/install.sh | sh`} />
        </Step>

        <Step n={2} icon={KeyRound} title="Create an API token & point the CLI here">
          <p className="text-sm text-muted-foreground">
            Create a token in Settings (one per machine/agent), then export it.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings">
              Create API token <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
          <CodeBlock
            code={`export PATH="$HOME/.local/bin:$PATH"\nexport LABNOTES_URL=${base}\nexport LABNOTES_TOKEN=lnk_…`}
          />
        </Step>

        <Step n={3} icon={Sparkles} title="Read & log findings">
          <p className="text-sm text-muted-foreground">
            Run from inside any git repo you have push access to — the CLI auto-detects
            the repo, branch and commit.
          </p>
          <CodeBlock
            code={`labnotes digest                       # read prior findings first\nlabnotes add "Chunk 512 → +3% accuracy" \\\n  --body "Re-ran eval; 0.89 → 0.92." \\\n  --metric accuracy --delta 0.03 --experiment rag-chunking`}
          />
        </Step>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" /> Claude Code skill
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Installed at <code>~/.claude/skills/labnotes</code>. It teaches agents the
              THINK → TEST → <span className="text-foreground">LOG</span> loop: pull prior
              evidence with <code>labnotes digest</code> before acting, and log every
              measurable result immediately.
            </p>
            <Button asChild size="sm" variant="ghost" className="px-0">
              <Link href="/install/skill" target="_blank">
                View SKILL.md <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4" /> Reminder hook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              This is where enforcement lives — a Stop hook that nudges the agent to log
              a finding after it commits experiment work. Enable it in your
              <code> .claude/settings.json</code>:
            </p>
            <Accordion type="single" collapsible>
              <AccordionItem value="hook" className="border-none">
                <AccordionTrigger className="py-1 text-sm">Show settings.json snippet</AccordionTrigger>
                <AccordionContent>
                  <CodeBlock
                    code={`{
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
}`}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4" /> For LLMs & agents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Point any LLM at <code>/llms.txt</code> for the full API guide (auth,
              endpoints, the recommended agent loop). The markdown digest is the
              token-efficient way to load prior evidence into context.
            </p>
            <Button asChild size="sm" variant="ghost" className="px-0">
              <Link href="/llms.txt" target="_blank">
                Open /llms.txt <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="size-4" /> Works with deeep-autoresearch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              LabNotes is the shared memory for{" "}
              <Link href={DEEEP} target="_blank" className="text-foreground underline decoration-dotted">
                deeep-autoresearch
              </Link>{" "}
              — its autonomous THINK→TEST→REFLECT runs log findings here via the API, and
              read prior evidence with the digest. Metric roles (objective/guard/tripwire)
              and citations go into the note&apos;s <code>meta</code> field.
            </p>
            <Button asChild size="sm" variant="ghost" className="px-0">
              <Link href={DEEEP} target="_blank">
                Open deeep-autoresearch <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Accordion type="single" collapsible className="rounded-xl border px-4">
        <AccordionItem value="manual" className="border-none">
          <AccordionTrigger>Manual install (without the one-liner)</AccordionTrigger>
          <AccordionContent>
            <CodeBlock
              code={`# CLI
curl -fsSL ${base}/install/cli -o ~/.local/bin/labnotes && chmod +x ~/.local/bin/labnotes

# Claude Code skill + hook
mkdir -p ~/.claude/skills/labnotes/hooks
curl -fsSL ${base}/install/skill -o ~/.claude/skills/labnotes/SKILL.md
curl -fsSL ${base}/install/hook  -o ~/.claude/skills/labnotes/hooks/labnotes-reminder.mjs`}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
