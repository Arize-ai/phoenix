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

  describe("getTraceDetailsPath encodes the trace ID into a same-origin segment", () => {
    const encode = (traceId: string) =>
      getTraceDetailsPath({ traceId, searchParams: new URLSearchParams() });

    it("encodes a protocol-relative trace ID into a single same-origin segment", () => {
      // Without encoding, React Router/the browser would resolve this as a
      // cross-origin protocol-relative href.
      expect(encode("//attacker.example/x")).toBe("%2F%2Fattacker.example%2Fx");
    });

    it("encodes absolute-path-shaped trace IDs", () => {
      expect(encode("/settings")).toBe("%2Fsettings");
    });

    it("encodes relative-path-shaped trace IDs", () => {
      expect(encode("../settings")).toBe("..%2Fsettings");
    });

    it("encodes whitespace and query/fragment characters", () => {
      expect(encode("trace id with spaces")).toBe("trace%20id%20with%20spaces");
      expect(encode("trace?x=y#frag")).toBe("trace%3Fx%3Dy%23frag");
    });

    it("leaves a legitimate 32-hex OpenTelemetry trace ID unchanged", () => {
      const hexTraceId = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
      expect(encode(hexTraceId)).toBe(hexTraceId);
    });
  });
});
