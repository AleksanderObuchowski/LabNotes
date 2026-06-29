"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { TokenSummary } from "@/lib/tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TokenManager({
  initialTokens,
  origin,
}: {
  initialTokens: TokenSummary[];
  origin: string;
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const minted = (await res.json()) as {
        id: string;
        name: string;
        token: string;
        token_prefix: string;
      };
      setFresh(minted.token);
      setTokens((t) => [
        {
          id: minted.id,
          name: minted.name,
          token_prefix: minted.token_prefix,
          created_at: Date.now(),
          last_used_at: null,
        },
        ...t,
      ]);
      setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/v1/tokens/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTokens((t) => t.filter((x) => x.id !== id));
      toast.success("Token revoked");
    } else {
      toast.error("Failed to revoke token");
    }
  }

  return (
    <div className="space-y-6">
      {fresh ? (
        <Alert>
          <AlertTitle>Copy your token now — it won&apos;t be shown again</AlertTitle>
          <AlertDescription>
            <code className="mt-1 block w-full break-all rounded bg-muted px-2 py-1 text-xs">
              {fresh}
            </code>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                navigator.clipboard.writeText(fresh);
                toast.success("Copied");
              }}
            >
              Copy
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create API token</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="flex items-end gap-3">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="token-name">Name</Label>
              <Input
                id="token-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="laptop / CI / claude-code"
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your tokens</CardTitle>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tokens yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell className="font-mono text-xs">{t.token_prefix}…</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {t.last_used_at
                        ? new Date(t.last_used_at).toISOString().slice(0, 16).replace("T", " ")
                        : "never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CLI setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
{`export LABNOTES_TOKEN=lnk_…
export LABNOTES_URL=${origin}

# from inside a git repo:
labnotes add "chunk 512 → +3% acc" --metric accuracy --delta 0.03 --experiment rag-chunking
labnotes digest`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
