import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-relay", () => ({
  graphql: vi.fn(),
  useLazyLoadQuery: vi.fn(() => ({ session: {} })),
  usePaginationFragment: vi.fn(() => ({
    data: {
      traces: {
        edges: [
          {
            trace: {
              errorCount: 0,
              id: "trace-node-id",
              rootSpan: {
                id: "root-span-node-id",
                spanId: "root-span-display-id",
              },
              traceId: "trace-display-id",
            },
          },
        ],
      },
    },
    hasNext: false,
    isLoadingNext: false,
    loadNext: vi.fn(),
  })),
}));

vi.mock("../TraceTurnContent", () => ({
  RootSpanMessage: () => null,
  TraceTurnContent: ({
    onMessageDoubleClick,
  }: {
    onMessageDoubleClick?: (role: "INPUT" | "OUTPUT") => void;
  }) => (
    <button type="button" onDoubleClick={() => onMessageDoubleClick?.("INPUT")}>
      Input
    </button>
  ),
}));

import { SessionConversation } from "../SessionDetailsTraceList";

describe("SessionConversation turn navigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("preserves the turn view as a browser Back destination", async () => {
    const initialEntry =
      "/projects/project-id/sessions/session-id?sessionView=turns&timeRangeKey=7d";
    const router = createMemoryRouter(
      [
        {
          path: "*",
          element: <SessionConversation sessionId="session-node-id" />,
        },
      ],
      { initialEntries: [initialEntry] }
    );
    await act(async () => {
      root.render(<RouterProvider router={router} />);
    });

    await act(async () => {
      container
        .querySelector("button")
        ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    const selectedSearchParams = new URLSearchParams(
      router.state.location.search
    );
    expect(selectedSearchParams.get("sessionView")).toBe("traces");
    expect(selectedSearchParams.get("selectedTraceId")).toBe(
      "trace-display-id"
    );
    expect(selectedSearchParams.get("selectedSpanNodeId")).toBe(
      "root-span-node-id"
    );
    expect(router.state.location.hash).toBe(
      "#span-details-root-span-display-id-input"
    );

    await act(async () => {
      await router.navigate(-1);
    });
    expect(
      `${router.state.location.pathname}${router.state.location.search}${router.state.location.hash}`
    ).toBe(initialEntry);
  });

  it("opens session turn input within the current trace panel", async () => {
    const initialEntry =
      "/projects/project-id/traces/current-trace?selectedSessionNodeId=session-node-id";
    const router = createMemoryRouter(
      [
        {
          path: "*",
          element: (
            <SessionConversation
              getTraceUrl={({ sectionId, spanNodeId, traceId }) =>
                `/projects/project-id/traces/${traceId}?selectedSpanNodeId=${spanNodeId}#${sectionId}`
              }
              sessionId="session-node-id"
            />
          ),
        },
      ],
      { initialEntries: [initialEntry] }
    );
    await act(async () => {
      root.render(<RouterProvider router={router} />);
    });

    await act(async () => {
      container
        .querySelector("button")
        ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    expect(
      `${router.state.location.pathname}${router.state.location.search}${router.state.location.hash}`
    ).toBe(
      "/projects/project-id/traces/trace-display-id?selectedSpanNodeId=root-span-node-id#span-details-root-span-display-id-input"
    );

    await act(async () => {
      await router.navigate(-1);
    });
    expect(
      `${router.state.location.pathname}${router.state.location.search}${router.state.location.hash}`
    ).toBe(initialEntry);
  });
});
