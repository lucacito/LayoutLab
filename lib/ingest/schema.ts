import { z } from 'zod';

const seoSchema = z
  .object({
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    ogImageKey: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .optional();

const tagSchema = z.object({
  axis: z.enum(['type', 'niche', 'style', 'feature']),
  slug: z.string().min(1),
});

export const ingestPayloadSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.string().min(1),
  niche: z.string().optional(),
  style: z.string().optional(),
  colors: z.array(z.string()).default([]),
  diviJsonBlobKey: z.string().min(1),
  previewImageKeys: z.array(z.string()).default([]),
  contentHash: z.string().min(1),
  perceptualHash: z.string().optional(),
  validatorPassed: z.boolean(),
  seo: seoSchema,
  tags: z.array(tagSchema).optional(),
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;

export function parseIngestPayload(
  raw: unknown,
): { ok: true; data: IngestPayload } | { ok: false; errors: z.ZodIssue[] } {
  const r = ingestPayloadSchema.safeParse(raw);
  return r.success ? { ok: true, data: r.data } : { ok: false, errors: r.error.issues };
}

export function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer (.+)$/.exec(header.trim());
  return m ? m[1].trim() : null;
}
