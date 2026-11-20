import { act } from "react";
import { createRoot } from "react-dom/client";
import type { GraphQLResponse } from "relay-runtime";
import { Observable } from "relay-runtime";
import { describe, expect, it } from "vitest";

import { useDeferredPayloadStatus } from "../useDeferredPayloadStatus";

describe("useDeferredPayloadStatus", () => {
  it("ignores the page request's failure once a refetch has completed", () => {
    const pageRequest: { fail: (error: Error) => void } = { fail: () => {} };
    const initialRequest = Observable.create<GraphQLResponse>((sink) => {
      pageRequest.fail = (error) => sink.error(error);
    });
    function Probe() {
      const { hasFailed, onRefetchComplete } = useDeferredPayloadStatus({
        initialRequest,
      });
      return (
        <button onClick={() => onRefetchComplete(null)}>
          {hasFailed ? "failed" : "not failed"}
        </button>
      );
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<Probe />));
    const button = container.querySelector("button");

    act(() => button?.click());
    act(() => pageRequest.fail(new Error("a part failed")));

    expect(button?.textContent).toBe("not failed");
    act(() => root.unmount());
  });
});
