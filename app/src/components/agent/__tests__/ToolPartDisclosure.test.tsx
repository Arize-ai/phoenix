import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AgentProvider } from "@phoenix/contexts/AgentContext";

import { ToolPart } from "../ToolPart";
import { ToolPartGroup } from "../ToolPartGroup";
import type { ToolInvocationPart } from "../toolPartTypes";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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

function createToolPart(
  overrides: Partial<ToolInvocationPart> = {}
): ToolInvocationPart {
  return {
    type: "tool-read_prompt",
    toolCallId: "tool-call-1",
    state: "output-available",
    input: {},
    output: "done",
    errorText: undefined,
    ...overrides,
  } as ToolInvocationPart;
}

function createAutoOpenToolPart(
  overrides: Partial<ToolInvocationPart> = {}
): ToolInvocationPart {
  return {
    type: "tool-edit_prompt",
    toolCallId: "tool-call-edit",
    state: "input-available",
    input: {
      instanceId: 0,
      expectedRevision: "prompt-1",
      operations: [
        {
          type: "update_message",
          messageId: 1,
          content: "Updated prompt",
        },
      ],
    },
    ...overrides,
  } as ToolInvocationPart;
}

function renderToolPart(part: ToolInvocationPart) {
  act(() => {
    root.render(
      <AgentProvider>
        <ToolPart part={part} />
      </AgentProvider>
    );
  });
}

function renderToolPartGroup(parts: ToolInvocationPart[]) {
  act(() => {
    root.render(
      <AgentProvider>
        <ToolPartGroup parts={parts} />
      </AgentProvider>
    );
  });
}

function click(element: Element | null) {
  expect(element).not.toBeNull();
  act(() => {
    element!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("tool disclosure controls", () => {
  it("expands and collapses a solo tool part", () => {
    renderToolPart(createToolPart());
    const details = container.querySelector("details.tool-part");
    const summary = container.querySelector("summary");

    expect(details?.hasAttribute("open")).toBe(false);

    click(summary);
    expect(details?.hasAttribute("open")).toBe(true);

    click(summary);
    expect(details?.hasAttribute("open")).toBe(false);
  });

  it("allows manually collapsing and expanding an auto-open solo tool part", () => {
    renderToolPart(createAutoOpenToolPart());
    const details = container.querySelector("details.tool-part");
    const summary = container.querySelector("summary");

    expect(details?.hasAttribute("open")).toBe(true);

    click(summary);
    expect(details?.hasAttribute("open")).toBe(false);

    click(summary);
    expect(details?.hasAttribute("open")).toBe(true);
  });

  it("allows manually collapsing and expanding an auto-open tool group", () => {
    renderToolPartGroup([
      createToolPart({ toolCallId: "tool-call-1" }),
      createToolPart({ toolCallId: "tool-call-2" }),
      createAutoOpenToolPart({ toolCallId: "tool-call-3" }),
    ]);
    const header = container.querySelector(".tool-pool__header");

    expect(container.querySelector(".tool-pool__body")).not.toBeNull();

    click(header);
    expect(container.querySelector(".tool-pool__body")).toBeNull();

    click(header);
    expect(container.querySelector(".tool-pool__body")).not.toBeNull();
  });
});
