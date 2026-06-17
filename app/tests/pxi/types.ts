export type PxiTurn = {
  calledTools: string[];
  assistantText: string;
  traceId: string;
  durationMs: number;
};

/**
 * A single typed context entry within a serialized PXI `/chat` request body.
 * Discriminated by `type` (e.g. "subagents", "web_access", "graphql"); the
 * remaining fields are capability-specific (e.g. `enabled`, `mutationsEnabled`).
 * Modeled loosely on purpose so protocol-level specs can assert on the raw
 * over-the-wire shape rather than the app's internal context types.
 */
export type PxiChatRequestContext = {
  type?: string;
  [key: string]: unknown;
};

/** Minimal view of the serialized PXI `/chat` request body. */
export type PxiChatRequestBody = {
  contexts?: PxiChatRequestContext[];
  [key: string]: unknown;
};

/** Outgoing `/chat` request paired with the backend's HTTP response status. */
export type PxiCapturedChatRequest = {
  requestBody: PxiChatRequestBody;
  responseStatus: number | null;
};
