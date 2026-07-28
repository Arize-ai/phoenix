import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SpanDetailsHeaderActions } from "../SpanDetailsHeaderActions";

describe("SpanDetailsHeaderActions", () => {
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

  function renderActions({
    isDisabled = false,
    spanKind,
  }: {
    isDisabled?: boolean;
    spanKind: string;
  }) {
    act(() => {
      root.render(
        <MemoryRouter>
          <SpanDetailsHeaderActions
            buttonText={{
              addToDataset: "Add to Dataset",
              download: "Download",
              playground: "Playground",
            }}
            isDisabled={isDisabled}
            projectId="project-id"
            spanId="span-id"
            spanKind={spanKind}
            spanNodeId="span-node-id"
            traceId="trace-id"
          />
        </MemoryRouter>
      );
    });
  }

  function getActions() {
    const playground = container.querySelector<HTMLElement>(
      '[aria-label="Prompt Playground"]'
    );
    const addToDataset = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add to Dataset"]'
    );
    const download = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Download span"]'
    );
    if (!playground || !addToDataset || !download) {
      throw new Error("Expected all span header actions to render");
    }
    return { addToDataset, download, playground };
  }

  it("keeps all actions enabled for an LLM span", () => {
    renderActions({ spanKind: "llm" });

    const { addToDataset, download, playground } = getActions();
    expect(playground.dataset.disabled).toBe("false");
    expect(addToDataset.disabled).toBe(false);
    expect(download.disabled).toBe(false);
  });

  it("only disables Playground for a non-LLM span", () => {
    renderActions({ spanKind: "chain" });

    const { addToDataset, download, playground } = getActions();
    expect(playground.dataset.disabled).toBe("true");
    expect(addToDataset.disabled).toBe(false);
    expect(download.disabled).toBe(false);
  });

  it("keeps all three actions rendered but disabled while transitioning", () => {
    renderActions({ isDisabled: true, spanKind: "llm" });

    const { addToDataset, download, playground } = getActions();
    expect(playground.dataset.disabled).toBe("true");
    expect(playground.getAttribute("aria-disabled")).toBe("true");
    expect(playground.tabIndex).toBe(-1);
    expect(addToDataset.disabled).toBe(true);
    expect(download.disabled).toBe(true);
  });
});
