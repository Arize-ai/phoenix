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
  /** Cost of the span, when pricing applied. Shaped as the API reports it. */
  costSummary?: {
    total?: { cost?: number | null } | null;
  } | null;
  [otherKeys: string]: unknown;
}

export type SpanStatusCodeType = "OK" | "ERROR" | "UNSET";
