import copy from "copy-to-clipboard";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MessageRewindActions } from "../MessageRewindActions";

vi.mock("copy-to-clipboard", () => ({
  default: vi.fn(),
}));

vi.mock("@phoenix/contexts/AgentContext", () => ({
  useAgentContext: <T,>(
    selector: (state: { capabilities: Record<string, boolean> }) => T
  ) =>
    selector({
      capabilities: {
        "session.storeSessions": true,
      },
    }),
}));

const TRACE_ID = "0123456789abcdef0123456789abcdef";

describe("MessageRewindActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.assign(globalThis, {
      CSS: {
        ...globalThis.CSS,
        escape: (value: string) => value,
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  function renderActions() {
    act(() => {
      root.render(
        <MessageRewindActions
          messageId="message-1"
          role="assistant"
          traceId={TRACE_ID}
          onRequest={vi.fn()}
        />
      );
    });
  }

  it("copies the trace ID from the overflow menu", () => {
    renderActions();

    const moreActionsButton = container.querySelector(
      'button[aria-label="More actions"]'
    );
    expect(moreActionsButton).not.toBeNull();

    act(() => {
      moreActionsButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    const menuItems = Array.from(
      document.body.querySelectorAll('[role="menuitem"]')
    );
    const copyTraceIdItem = menuItems.find((item) =>
      item.textContent?.includes("Copy trace ID")
    );
    expect(copyTraceIdItem).not.toBeNull();
    expect(menuItems.at(-1)).toBe(copyTraceIdItem);

    act(() => {
      copyTraceIdItem!.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    expect(copy).toHaveBeenCalledWith(TRACE_ID);
  });
});
