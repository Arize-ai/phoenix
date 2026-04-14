import type { UIMessage } from "ai";
import { z } from "zod";

/**
 * Assistant-message metadata emitted by the PXI `/chat` stream.
 *
 * The IDs are the raw OpenTelemetry identifiers for the root AGENT span that
 * represents the current PXI turn.
 */
export const pxiMessageMetadataSchema = z.object({
  traceId: z.string(),
  rootSpanId: z.string(),
  sessionId: z.string(),
});

export type PxiMessageMetadata = z.infer<typeof pxiMessageMetadataSchema>;

export type PxiUIMessage = UIMessage<PxiMessageMetadata>;
