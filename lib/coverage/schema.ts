import { z } from 'zod';

// Anonymous by construction: a product identifier and a list of Elementor
// widget type names. Nothing here can identify a site or a person.
export const coveragePayloadSchema = z.object({
  product: z.enum(['elementor-to-divi5', 'divi-to-elementor']),
  widget_types: z.array(z.string().min(1).max(64)).min(1).max(100),
});

export type CoveragePayload = z.infer<typeof coveragePayloadSchema>;
