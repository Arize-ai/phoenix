/**
 * A generic interface for a span to be re-used as a constraint
 */
export interface ISpanItem {
  id: string;
  name: string;
  spanKind: string;
  statusCode: SpanStatusCodeType;
  latencyMs: number | null;
  startTime: string;
  endTime: string | null;
  parentId: string | null;
  spanId: string;
  tokenCountTotal?: number | null;
  [otherKeys: string]: unknown;
}

export type SpanStatusCodeType = "OK" | "ERROR" | "UNSET";
