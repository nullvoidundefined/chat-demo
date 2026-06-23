/** Zod schema for the LLM judge's structured score output. */
import { z } from 'zod';

export const ScoreSchema = z.object({
    factuality: z.number().min(1).max(10),
    citationUse: z.number().min(1).max(10),
    completeness: z.number().min(1).max(10),
    toolEfficiency: z.number().min(1).max(10),
    rationale: z.string(),
    pass: z.boolean(),
});
