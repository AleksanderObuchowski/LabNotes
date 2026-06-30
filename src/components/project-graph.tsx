"use client";

import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  FileText,
} from "lucide-react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  NOTE_KINDS,
  NOTE_REL_LABELS,
  type Note,
  type NoteKind,
  type NoteRel,
} from "@/lib/types";
import { KIND_META } from "@/components/kind-badge";
import { cn } from "@/lib/utils";

// --- layout constants -------------------------------------------------------
// Kind → column: research → devlog → finding reads left-to-right, the canonical
// research → test → reflect flow. Notes group into horizontal bands by experiment.
const COL_X: Record<NoteKind, number> = { research: 0, devlog: 320, finding: 640 };
const NODE_W = 232;
const ROW_H = 92;
const BAND_PAD = 64;
const LABEL_H = 30;

const REL_COLOR: Record<NoteRel, string> = {
  confirms: "#10b981", // emerald
  refutes: "#ef4444", // red
  satisfies: "#f59e0b", // amber
  related: "#71717a", // muted
};

// MiniMap dot colour per kind (hex mirrors KIND_META tailwind tokens).
const KIND_DOT: Record<NoteKind, string> = {
  finding: "#38bdf8",
  research: "#a78bfa",
  devlog: "#fbbf24",
};

type NoteNodeData = { note: Note; onSelect: (n: Note) => void };

// Compact card for a single note. Click opens the shared NoteDialog.
function NoteNode({ data }: NodeProps<Node<NoteNodeData>>) {
  const { note, onSelect } = data;
  const meta = KIND_META[note.kind];
  const Icon = meta.icon;
  const delta = note.delta;
  const DeltaIcon = delta == null ? null : delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : ArrowRight;
  const deltaColor =
    delta == null || delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-emerald-500" : "text-red-500";

  return (
    <button
      type="button"
      onClick={() => onSelect(note)}
      style={{ width: NODE_W }}
      className={cn(
        "flex flex-col gap-1 rounded-lg border bg-card px-3 py-2 text-left shadow-sm transition-colors hover:bg-muted/50",
        meta.className.split(" ").find((c) => c.startsWith("border-")),
      )}
    >
      {/* Handles on both sides so edges can attach to whichever is nearer. */}
      <Handle id="tl" type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-muted-foreground/40" />
      <Handle id="sl" type="source" position={Position.Left} className="!size-1.5 !border-0 !bg-muted-foreground/40" />
      <Handle id="tr" type="target" position={Position.Right} className="!size-1.5 !border-0 !bg-muted-foreground/40" />
      <Handle id="sr" type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-muted-foreground/40" />

      <div className="flex items-center gap-1.5">
        <Icon className={cn("size-3.5 shrink-0", meta.className.split(" ")[0])} />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{meta.label}</span>
        {note.metric && DeltaIcon ? (
          <span className={cn("ml-auto inline-flex items-center gap-0.5 font-mono text-[10px]", deltaColor)}>
            <DeltaIcon className="size-3" />
            {delta != null && delta > 0 ? "+" : ""}
            {delta}
          </span>
        ) : null}
      </div>
      <span className="line-clamp-2 text-xs font-medium leading-snug">{note.title}</span>
    </button>
  );
}

const bandLabelStyle: React.CSSProperties = { pointerEvents: "none" };

// Static band heading (experiment name), rendered to the left of the columns.
function BandLabel({ data }: NodeProps<Node<{ label: string }>>) {
  return (
    <div style={bandLabelStyle} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
      {data.label}
    </div>
  );
}

const nodeTypes = { noteNode: NoteNode, bandLabel: BandLabel };

// Deterministic columnar layout: linked notes grouped into experiment bands,
// unlinked notes collected in a trailing "Unlinked" band. Returns RF nodes+edges.
function layout(notes: Note[], onSelect: (n: Note) => void): { nodes: Node[]; edges: Edge[] } {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const referenced = new Set<string>();
  for (const n of notes) for (const r of n.refs) referenced.add(r.id);

  const isLinked = (n: Note) => n.refs.length > 0 || referenced.has(n.id);
  const linked = notes.filter(isLinked);
  const orphans = notes.filter((n) => !isLinked(n));

  // Group linked notes by experiment (stable insertion order).
  const bands = new Map<string, Note[]>();
  for (const n of linked) {
    const key = n.experiment ?? "(ungrouped)";
    if (!bands.has(key)) bands.set(key, []);
    bands.get(key)!.push(n);
  }
  if (orphans.length) bands.set("Unlinked", orphans);

  const nodes: Node[] = [];
  const x = new Map<string, number>();
  let y = 0;

  for (const [label, group] of bands) {
    // Band heading.
    nodes.push({
      id: `band-${label}`,
      type: "bandLabel",
      position: { x: -16, y },
      data: { label },
      draggable: false,
      selectable: false,
    });
    const top = y + LABEL_H;

    // Stack notes within each kind column, oldest first.
    const perCol: Record<NoteKind, number> = { finding: 0, research: 0, devlog: 0 };
    const sorted = [...group].sort((a, b) => a.created_at - b.created_at);
    let rows = 0;
    for (const n of sorted) {
      const col = perCol[n.kind]++;
      rows = Math.max(rows, col + 1);
      const nx = COL_X[n.kind];
      const ny = top + col * ROW_H;
      x.set(n.id, nx);
      nodes.push({
        id: n.id,
        type: "noteNode",
        position: { x: nx, y: ny },
        data: { note: n, onSelect },
      });
    }
    y = top + Math.max(rows, 1) * ROW_H + BAND_PAD;
  }

  // Edges from typed refs; attach to the side facing the target.
  const edges: Edge[] = [];
  for (const n of notes) {
    n.refs.forEach((r, i) => {
      if (!byId.has(r.id)) return;
      const color = REL_COLOR[r.rel] ?? REL_COLOR.related;
      const srcX = x.get(n.id) ?? 0;
      const tgtX = x.get(r.id) ?? 0;
      const leftward = srcX > tgtX;
      edges.push({
        id: `${n.id}-${i}-${r.id}`,
        source: n.id,
        target: r.id,
        sourceHandle: leftward ? "sl" : "sr",
        targetHandle: leftward ? "tr" : "tl",
        label: NOTE_REL_LABELS[r.rel],
        animated: r.rel === "confirms" || r.rel === "satisfies",
        style: { stroke: color, strokeWidth: 1.5 },
        labelStyle: { fill: color, fontSize: 11, fontWeight: 500 },
        labelBgStyle: { fill: "hsl(240 10% 12%)", fillOpacity: 0.85 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      });
    });
  }

  return { nodes, edges };
}

function Legend() {
  return (
    <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5 rounded-lg border bg-card/90 px-3 py-2 text-xs backdrop-blur">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {NOTE_KINDS.map((k) => {
          const Icon = KIND_META[k].icon;
          return (
            <span key={k} className="inline-flex items-center gap-1 text-muted-foreground">
              <Icon className={cn("size-3", KIND_META[k].className.split(" ")[0])} />
              {KIND_META[k].label}
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {(Object.keys(REL_COLOR) as NoteRel[]).map((rel) => (
          <span key={rel} className="inline-flex items-center gap-1 text-muted-foreground">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: REL_COLOR[rel] }} />
            {rel}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProjectGraph({ notes, onSelect }: { notes: Note[]; onSelect: (n: Note) => void }) {
  const { nodes, edges } = useMemo(() => layout(notes, onSelect), [notes, onSelect]);

  if (notes.length === 0) {
    return (
      <div className="flex h-[72vh] flex-col items-center justify-center gap-2 rounded-xl border bg-card text-center">
        <FileText className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No notes to graph yet.</p>
      </div>
    );
  }

  return (
    <div className="relative h-[72vh] overflow-hidden rounded-xl border bg-card">
      <Legend />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        nodesConnectable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.type === "noteNode" ? KIND_DOT[(n.data as NoteNodeData).note.kind] : "transparent")}
          maskColor="hsl(240 10% 6% / 0.6)"
          className="!bg-card"
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
