/**
 * A generic interface for a span to be re-used as a constraint
 */
export interface ISpanItem {
  name: string;
  spanKind: string;
  latencyMs: number;
  startTime: string;
  parentId: string | null;
  context: {
    spanId: string;
  };
}

export type SpanStatusCodeType = "OK" | "ERROR" | "UNSET";
