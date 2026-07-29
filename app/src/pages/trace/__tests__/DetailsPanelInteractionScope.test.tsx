import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DetailsPanelInteractionScope,
  useIsDetailsPanelInteractionActive,
} from "../DetailsPanelInteractionScope";

function InteractionState() {
  const isActive = useIsDetailsPanelInteractionActive();
  return <output data-testid="interaction-state">{String(isActive)}</output>;
}

function TestScope() {
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <DetailsPanelInteractionScope rootRef={rootRef}>
      <div ref={rootRef} data-testid="details-panel-root">
        <div data-testid="details-panel-content" />
      </div>
      <InteractionState />
    </DetailsPanelInteractionScope>
  );
}

describe("DetailsPanelInteractionScope", () => {
  let container: HTMLDivElement;
  let outside: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    outside = document.createElement("div");
    document.body.append(container, outside);
    root = createRoot(container);
    act(() => root.render(<TestScope />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    outside.remove();
  });

  function getInteractionState() {
    return container.querySelector('[data-testid="interaction-state"]')
      ?.textContent;
  }

  function dispatchInteraction(
    target: Element,
    type: "focusin" | "pointerdown"
  ) {
    act(() => {
      target.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
    });
  }

  it("follows the most recently interacted-with region", () => {
    const detailsContent = container.querySelector(
      '[data-testid="details-panel-content"]'
    );
    if (!detailsContent) throw new Error("Expected details panel content");

    expect(getInteractionState()).toBe("false");

    dispatchInteraction(detailsContent, "pointerdown");
    expect(getInteractionState()).toBe("true");

    dispatchInteraction(outside, "pointerdown");
    expect(getInteractionState()).toBe("false");

    dispatchInteraction(detailsContent, "focusin");
    expect(getInteractionState()).toBe("true");

    dispatchInteraction(outside, "focusin");
    expect(getInteractionState()).toBe("false");
  });
});
