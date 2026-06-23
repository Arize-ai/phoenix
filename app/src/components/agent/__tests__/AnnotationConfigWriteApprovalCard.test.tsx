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

function findInputByValue(value: string): HTMLInputElement {
  const input = Array.from(container.querySelectorAll("input")).find(
    (candidate) => candidate.value === value
  );
  expect(input).toBeDefined();
  return input as HTMLInputElement;
}

async function changeInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function click(element: Element | null) {
  expect(element).not.toBeNull();
  await act(async () => {
    element!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("AnnotationConfigWriteApprovalCard", () => {
  it("submits the edited categorical draft when creating a config", async () => {
    const acceptDraft = vi.fn().mockResolvedValue(undefined);
    renderCard({
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
      acceptDraft,
      accept: async () => undefined,
      reject: async () => undefined,
    });

    expect(container.textContent).not.toContain("Create annotation config");
    expect(container.textContent).toContain("Create config");
    expect(container.textContent).not.toContain("project-1");

    await changeInput(findInputByValue("tool_selection"), "accuracy");
    await changeInput(findInputByValue("incorrect"), "wrong");
    await click(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Create config"
      ) ?? null
    );

    expect(acceptDraft).toHaveBeenCalledTimes(1);
    expect(acceptDraft).toHaveBeenCalledWith({
      type: "categorical",
      name: "accuracy",
      description: null,
      optimizationDirection: "MAXIMIZE",
      values: [
        { label: "correct", score: 1 },
        { label: "wrong", score: 0 },
      ],
    });
  });
});
