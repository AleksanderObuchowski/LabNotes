"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`group relative ${className ?? ""}`}>
      <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 pr-12 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="absolute right-2 top-2 size-7"
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          toast.success("Copied");
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}
