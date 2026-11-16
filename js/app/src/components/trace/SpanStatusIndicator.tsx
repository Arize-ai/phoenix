import type { StatusCategory } from "@phoenix/components";
import { StatusIndicator } from "@phoenix/components";

import type { SpanStatusCodeType } from "./types";

const SPAN_STATUSES: Record<
  SpanStatusCodeType,
  { category: StatusCategory; label: string }
> = {
  OK: { category: "succeeded", label: "OK" },
  ERROR: { category: "failed", label: "Error" },
  UNSET: { category: "unset", label: "Unset" },
};

export function SpanStatusIndicator({
  statusCode,
  isLabelHidden,
}: {
  statusCode: SpanStatusCodeType;
  isLabelHidden?: boolean;
}) {
  return (
    <StatusIndicator
      {...SPAN_STATUSES[statusCode]}
      isLabelHidden={isLabelHidden}
    />
  );
}
