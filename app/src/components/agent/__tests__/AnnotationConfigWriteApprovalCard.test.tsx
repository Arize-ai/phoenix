import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import type { PendingAnnotationConfigWrite } from "@phoenix/agent/tools/annotationConfig";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { AnnotationConfigWriteApprovalCard } from "../AnnotationConfigWriteApprovalCard";

installTestStorage();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
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
});

function renderCard(pending: PendingAnnotationConfigWrite) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <AnnotationConfigWriteApprovalCard pending={pending} />
      </ThemeProvider>
    );
  });
}

function click(element: Element | null) {
  expect(element).not.toBeNull();
  act(() => {
    element!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function createPending(
  overrides: Partial<PendingAnnotationConfigWrite> = {}
): PendingAnnotationConfigWrite {
  return {
    toolCallId: "tool-call-1",
    toolName: "create_annotation_config",
    preview: {
      kind: "create",
      projectId: "project-1",
      draft: {
        type: "categorical",
        name: "tool_selection",
        optimizationDirection: "MAXIMIZE",
        values: [
          { label: "correct", score: 1 },
          { label: "incorrect", score: 0 },
        ],
      },
    },
    accept: async () => undefined,
    reject: async () => undefined,
    ...overrides,
  };
}

describe("AnnotationConfigWriteApprovalCard", () => {
  it("renders a read-only preview of the proposed config", () => {
    renderCard(createPending());

    expect(container.textContent).toContain("Create annotation config");
    expect(container.textContent).toContain("tool_selection");
    expect(container.textContent).toContain("correct");
    expect(container.textContent).toContain("project-1");
    expect(container.querySelectorAll("input, textarea")).toHaveLength(0);
  });

  it("warns that an update replaces the entire config", () => {
    renderCard(
      createPending({
        toolName: "update_annotation_config",
        preview: {
          kind: "update",
          configId: "config-1",
          draft: { type: "freeform", name: "notes" },
        },
      })
    );

    expect(container.textContent).toContain("Replace annotation config");
    expect(container.textContent).toContain("config-1");
    expect(container.textContent).toContain("Replaces the entire config");
  });

  it("disables the buttons and explains when the proposal is stale", () => {
    renderCard(createPending({ accept: undefined, reject: undefined }));

    const buttons = Array.from(container.querySelectorAll("button"));
    const acceptButton = buttons.find(
      (button) => button.textContent === "Accept"
    );
    const rejectButton = buttons.find(
      (button) => button.textContent === "Reject"
    );
    expect(acceptButton?.disabled).toBe(true);
    expect(rejectButton?.disabled).toBe(true);
    expect(container.textContent).toContain("made in an earlier session");
  });

  it("invokes accept and reject handlers from the card buttons", () => {
    const accept = vi.fn().mockResolvedValue(undefined);
    const reject = vi.fn().mockResolvedValue(undefined);
    renderCard(createPending({ accept, reject }));

    const buttons = Array.from(container.querySelectorAll("button"));
    click(buttons.find((button) => button.textContent === "Accept") ?? null);
    expect(accept).toHaveBeenCalledTimes(1);
    click(buttons.find((button) => button.textContent === "Reject") ?? null);
    expect(reject).toHaveBeenCalledTimes(1);
  });
});
