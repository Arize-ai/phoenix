import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const relay = vi.hoisted(() => ({
  loadQuery: vi.fn(),
  queryRef: {},
}));

vi.mock("react-relay", () => ({
  graphql: vi.fn(() => ({})),
  useLazyLoadQuery: vi.fn(),
  useMutation: vi.fn(),
  usePreloadedQuery: vi.fn(),
  useQueryLoader: vi.fn(() => [relay.queryRef, relay.loadQuery]),
}));

import { useSpanDetailPanelAnnotationBarQuery } from "../ConnectedDetailPanelAnnotationBar";

function QueryOwner({ spanNodeId }: { spanNodeId: string }) {
  useSpanDetailPanelAnnotationBarQuery(spanNodeId);
  return null;
}

describe("useSpanDetailPanelAnnotationBarQuery", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    relay.loadQuery.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("starts a store-and-network request from the owning span lifecycle", async () => {
    await act(async () => {
      root.render(<QueryOwner spanNodeId="span-node-id" />);
    });

    expect(relay.loadQuery).toHaveBeenCalledOnce();
    expect(relay.loadQuery).toHaveBeenCalledWith(
      { id: "span-node-id" },
      { fetchPolicy: "store-and-network" }
    );
  });
});
