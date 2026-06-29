import { Code2, FlaskConical, Microscope } from "lucide-react";
import type { NoteKind } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Shared visual identity for the three note kinds — reused by the feed and the
// note detail dialog so a finding / research / devlog always reads the same.
export const KIND_META: Record<
  NoteKind,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  finding: { label: "Finding", icon: FlaskConical, className: "text-sky-400 border-sky-500/30" },
  research: { label: "Research", icon: Microscope, className: "text-violet-400 border-violet-500/30" },
  devlog: { label: "Devlog", icon: Code2, className: "text-amber-400 border-amber-500/30" },
};

export function KindBadge({ kind, className }: { kind: NoteKind; className?: string }) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", meta.className, className)}>
      <Icon className="size-3" />
      {meta.label}
    </Badge>
  );
}
