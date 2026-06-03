import { z } from "zod";

export const agentRouteMetadataSchema = z
  .object({
    label: z.string(),
    description: z.string(),
  })
  // Keep assistant-facing route metadata constrained to the intentionally
  // small contract documented by the tool: label and description only.
  .strict();

export type AgentRouteMetadata = z.infer<typeof agentRouteMetadataSchema>;
