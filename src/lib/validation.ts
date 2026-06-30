import { z } from "zod";
import { NOTE_KINDS, NOTE_RELS } from "./types";

export const createNoteSchema = z.object({
  repo: z.string().min(1, "repo is required"),
  kind: z.enum(NOTE_KINDS).default("finding"),
  title: z.string().min(1, "title is required").max(300),
  text: z.string().max(20_000).optional(),
  metric: z.string().max(200).optional(),
  value: z.number().optional(),
  delta: z.number().optional(),
  experiment: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  branch: z.string().max(300).optional(),
  commit: z.string().max(100).optional(),
  refs: z
    .array(z.object({ rel: z.enum(NOTE_RELS), id: z.string().min(1).max(100) }))
    .max(50)
    .optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type CreateNoteBody = z.infer<typeof createNoteSchema>;

// Partial update: every field optional; `null` explicitly clears a value,
// an absent key leaves it untouched. `repo` is fixed (derived from the note).
export const updateNoteSchema = z.object({
  kind: z.enum(NOTE_KINDS).optional(),
  title: z.string().min(1, "title cannot be empty").max(300).optional(),
  text: z.string().max(20_000).nullable().optional(),
  metric: z.string().max(200).nullable().optional(),
  value: z.number().nullable().optional(),
  delta: z.number().nullable().optional(),
  experiment: z.string().max(200).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).nullable().optional(),
  branch: z.string().max(300).nullable().optional(),
  commit: z.string().max(100).nullable().optional(),
  refs: z
    .array(z.object({ rel: z.enum(NOTE_RELS), id: z.string().min(1).max(100) }))
    .max(50)
    .nullable()
    .optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type UpdateNoteBody = z.infer<typeof updateNoteSchema>;

export const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
});
