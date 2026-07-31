import { describe, expect, it, vi } from "vitest";

import { createSessionDetailsSearchParamsStore } from "../sessionDetailsSearchParamsStore";

describe("sessionDetailsSearchParamsStore", () => {
  it("keeps span selection local until content is ready", () => {
    const store = createSessionDetailsSearchParamsStore(
      new URLSearchParams(
        "sessionView=traces&selectedTraceId=trace-a&selectedSpanNodeId=span-a"
      )
    );
    const setSearchParams = vi.fn();
    const onSpanSelectionChange = vi.fn();
    store.connectToRouter(
      new URLSearchParams(
        "sessionView=traces&selectedTraceId=trace-a&selectedSpanNodeId=span-a"
      ),
      setSearchParams
    );
    store.subscribeToSpanSelection(onSpanSelectionChange);

    store.prepareSpanSelection({ traceId: "trace-a", spanNodeId: "span-b" });

    expect(store.getSpanSelection()).toEqual({
      traceId: "trace-a",
      spanNodeId: "span-b",
    });
    expect(onSpanSelectionChange).toHaveBeenCalledOnce();
    expect(setSearchParams).not.toHaveBeenCalled();

    store.synchronizeSpanSelection({
      traceId: "trace-a",
      spanNodeId: "span-b",
    });

    expect(setSearchParams).toHaveBeenCalledOnce();
    const nextSearchParams = setSearchParams.mock.calls[0]?.[0];
    expect(nextSearchParams).toBeInstanceOf(URLSearchParams);
    expect(nextSearchParams.get("selectedSpanNodeId")).toBe("span-b");
  });

  it("notifies span selection subscribers for external navigation", () => {
    const initialSearchParams = new URLSearchParams(
      "sessionView=traces&selectedTraceId=trace-a&selectedSpanNodeId=span-a"
    );
    const store = createSessionDetailsSearchParamsStore(initialSearchParams);
    const onSpanSelectionChange = vi.fn();
    store.subscribeToSpanSelection(onSpanSelectionChange);

    store.connectToRouter(
      new URLSearchParams(
        "sessionView=traces&selectedTraceId=trace-b&selectedSpanNodeId=span-b"
      ),
      vi.fn()
    );

    expect(onSpanSelectionChange).toHaveBeenCalledOnce();
    expect(store.getSpanSelection()).toEqual({
      traceId: "trace-b",
      spanNodeId: "span-b",
    });
  });

  it("selects a trace without proxying through its root span", () => {
    const initialSearchParams = new URLSearchParams(
      "sessionView=traces&selectedTraceId=trace-a&selectedSpanNodeId=span-a"
    );
    const store = createSessionDetailsSearchParamsStore(initialSearchParams);
    const setSearchParams = vi.fn();
    const onSelectionChange = vi.fn();
    store.connectToRouter(initialSearchParams, setSearchParams);
    store.subscribeToSpanSelection(onSelectionChange);

    store.selectTrace("trace-b");

    expect(store.getSpanSelection()).toEqual({
      traceId: "trace-b",
      spanNodeId: null,
    });
    expect(onSelectionChange).toHaveBeenCalledOnce();
    const nextSearchParams = setSearchParams.mock.calls[0]?.[0];
    expect(nextSearchParams.get("selectedTraceId")).toBe("trace-b");
    expect(nextSearchParams.has("selectedSpanNodeId")).toBe(false);
  });

  it("ignores a stale router echo while a newer local selection is pending", () => {
    const initialSearchParams = new URLSearchParams(
      "sessionView=traces&selectedTraceId=trace-a&selectedSpanNodeId=span-a"
    );
    const store = createSessionDetailsSearchParamsStore(initialSearchParams);
    const setSearchParams = vi.fn();
    const onExternalSelection = vi.fn();
    store.connectToRouter(initialSearchParams, setSearchParams);
    store.subscribeToExternalSelection(onExternalSelection);

    store.prepareSpanSelection({ traceId: "trace-a", spanNodeId: "span-b" });
    store.connectToRouter(initialSearchParams, setSearchParams);

    expect(store.getSpanSelection().spanNodeId).toBe("span-b");
    expect(onExternalSelection).not.toHaveBeenCalled();
  });

  it("notifies only the small session-view subscriber for view changes", () => {
    const store = createSessionDetailsSearchParamsStore(
      new URLSearchParams("sessionView=traces")
    );
    const setSearchParams = vi.fn();
    const onSessionViewChange = vi.fn();
    store.connectToRouter(
      new URLSearchParams("sessionView=traces"),
      setSearchParams
    );
    store.subscribeToSessionView(onSessionViewChange);

    store.setSessionViewParam("turns");

    expect(onSessionViewChange).toHaveBeenCalledOnce();
    expect(store.getSessionViewParam()).toBe("turns");
  });
});
