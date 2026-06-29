"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddNoteDialog({ repo }: { repo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) {
      toast.error("Title is required");
      return;
    }
    const text = String(fd.get("text") ?? "").trim();
    const num = (k: string) => {
      const v = String(fd.get(k) ?? "").trim();
      return v === "" ? undefined : Number(v);
    };
    const str = (k: string) => {
      const v = String(fd.get(k) ?? "").trim();
      return v === "" ? undefined : v;
    };
    const tagsRaw = String(fd.get("tags") ?? "").trim();
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

    setSaving(true);
    try {
      const res = await fetch("/api/v1/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo,
          title,
          text: text || undefined,
          metric: str("metric"),
          value: num("value"),
          delta: num("delta"),
          experiment: str("experiment"),
          tags,
          branch: str("branch"),
          commit: str("commit"),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      toast.success("Finding logged");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log finding");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add note</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Log a finding</DialogTitle>
            <DialogDescription>
              A finding or observation for <code>{repo}</code>. Only the title is
              required — metrics are optional.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="Chunk size 512 raises retrieval accuracy by ~3%"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="text">
                Details <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="text"
                name="text"
                placeholder="Longer notes, context, caveats, how you measured it…"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="metric">
                  Metric <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input id="metric" name="metric" placeholder="accuracy" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="value">Value</Label>
                <Input id="value" name="value" type="number" step="any" placeholder="0.92" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="delta">Delta</Label>
                <Input id="delta" name="delta" type="number" step="any" placeholder="0.03" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="experiment">Experiment</Label>
                <Input id="experiment" name="experiment" placeholder="rag-chunking" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tags">Tags</Label>
                <Input id="tags" name="tags" placeholder="rag, prompt" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="branch">Branch</Label>
                <Input id="branch" name="branch" placeholder="main" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="commit">Commit SHA</Label>
                <Input id="commit" name="commit" placeholder="abc1234…" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Log finding"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
