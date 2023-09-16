/**
 * A generic interface for a span to be re-used as a constraint
 */
export interface ISpanItem {
  name: string;
  spanKind: string;
  statusCode: SpanStatusCodeType;
  latencyMs: number | null;
  startTime: string;
  parentId: string | null;
  context: ISpanContext;
  [otherKeys: string]: unknown;
  tokenCountTotal?: number | null;
  tokenCountPrompt?: number | null;
  tokenCountCompletion?: number | null;
}

interface ISpanContext {
  spanId: string;
  [otherKeys: string]: unknown;
}

export type SpanStatusCodeType = "OK" | "ERROR" | "UNSET";
