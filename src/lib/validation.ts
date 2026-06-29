import { z } from "zod";

export const createNoteSchema = z.object({
  repo: z.string().min(1, "repo is required"),
  title: z.string().min(1, "title is required").max(300),
  text: z.string().max(20_000).optional(),
  metric: z.string().max(200).optional(),
  value: z.number().optional(),
  delta: z.number().optional(),
  experiment: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  branch: z.string().max(300).optional(),
  commit: z.string().max(100).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type CreateNoteBody = z.infer<typeof createNoteSchema>;

export const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
});
