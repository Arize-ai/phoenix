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

/** Header and action data that may already be available before details load. */
export type SpanDetailsPreview = Pick<ISpanItem, "id" | "name"> &
  Partial<
    Pick<
      ISpanItem,
      | "latencyMs"
      | "spanId"
      | "spanKind"
      | "startTime"
      | "statusCode"
      | "tokenCountTotal"
    >
  > & {
    projectId?: string;
    traceId?: string;
  };

export type SpanStatusCodeType = "OK" | "ERROR" | "UNSET";
