import { z } from "zod";

/**
 * Vercel AI Tool Definition Schema
 *
 * Produces the same result as if you called `import { jsonSchema } from "ai"`
 * https://github.com/vercel/ai/blob/83976abfa99bf26f8227cf493386b8a6f0e71fdd/packages/ui-utils/src/schema.ts#L34
 */
export const vercelAIToolDefinitionSchema = z.object({
  type: z.literal("function"),
  description: z.string().optional(),
  inputSchema: z.object({
    _type: z.unknown().optional().default(undefined),
    validate: z.unknown().optional().default(undefined),
    jsonSchema: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type VercelAIToolDefinition = z.infer<
  typeof vercelAIToolDefinitionSchema
>;
