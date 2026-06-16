import { describe, expect, it } from "vitest";

import {
  clearSelectionScopedParams,
  getTraceDetailsPath,
} from "@phoenix/utils/urlUtils";

describe("urlUtils", () => {
  it("clears selection-scoped params while preserving recreatable state", () => {
    expect(
      clearSelectionScopedParams(
        "?timeRangeKey=7d&selectedTraceId=trace-1&selectedSpanNodeId=span-1"
      )
    ).toBe("?timeRangeKey=7d");
  });

  it("builds trace details paths without leaking stale selection params", () => {
    expect(
      getTraceDetailsPath({
        traceId: "trace-2",
        spanNodeId: "span-2",
        searchParams: new URLSearchParams(
          "timeRangeKey=7d&selectedTraceId=trace-1&selectedSpanNodeId=span-1"
        ),
      })
    ).toBe("trace-2?timeRangeKey=7d&selectedSpanNodeId=span-2");
  });
});
