import type { UIMessage } from "ai";
import { z } from "zod";

/**
 * Assistant-message metadata emitted by the `/chat` stream.
 *
 * The IDs are the raw OpenTelemetry identifiers for the root AGENT span that
 * represents the current agent turn.
 */
export const assistantMessageMetadataSchema = z.object({
  traceId: z.string(),
  rootSpanId: z.string(),
  sessionId: z.string(),
});

export type AssistantMessageMetadata = z.infer<
  typeof assistantMessageMetadataSchema
>;

export type AgentUIMessage = UIMessage<AssistantMessageMetadata>;
