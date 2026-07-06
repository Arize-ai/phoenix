import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BATCH_SPAN_ANNOTATE_TOOL_NAME } from "@phoenix/agent/tools/batchSpanAnnotate";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import { createAgentStore } from "@phoenix/store/agentStore";

import { BatchSpanAnnotateToolDetails } from "../BatchSpanAnnotateToolDetails";
import type { ToolInvocationPart } from "../toolPartTypes";

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

function createBatchSpanAnnotatePart(): ToolInvocationPart {
  return {
    type: `tool-${BATCH_SPAN_ANNOTATE_TOOL_NAME}`,
    toolCallId: "tool-call-1",
    state: "input-available",
    input: { annotations: [] },
    output: undefined,
    errorText: undefined,
  } as ToolInvocationPart;
}

function renderPendingAnnotations(annotations: PendingAnnotation[]) {
  const agentStore = createAgentStore();
  agentStore.getState().setPendingApproval("tool-call-1", {
    toolCallId: "tool-call-1",
    toolName: BATCH_SPAN_ANNOTATE_TOOL_NAME,
    sessionId: "session-1",
    annotations,
    accept: async () => undefined,
    reject: async () => undefined,
  });

  act(() => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <AgentContext.Provider value={agentStore}>
          <BatchSpanAnnotateToolDetails part={createBatchSpanAnnotatePart()} />
        </AgentContext.Provider>
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

type PendingAnnotation = {
  spanId?: string;
  spanNodeId?: string;
  name: string;
  annotatorKind: "LLM";
  label: string | null;
  score: number | null;
  explanation: string | null;
  identifier: string | null;
  metadata: Record<string, unknown> | null;
};

function createAnnotation(index: number): PendingAnnotation {
  return {
    spanId: `abcdef012345678${index}`,
    name: `quality-${index}`,
    annotatorKind: "LLM",
    label: "good",
    score: null,
    explanation: `Reason ${index}`,
    identifier: null,
    metadata: null,
  };
}

describe("BatchSpanAnnotateToolDetails", () => {
  it("shows target spans without exposing internal field names", () => {
    renderPendingAnnotations([
      createAnnotation(0),
      {
        ...createAnnotation(1),
        spanId: undefined,
        spanNodeId: "U3Bhbjox",
      },
    ]);

    expect(container.textContent).toContain("Target");
    expect(container.textContent).toContain("Span abcdef...6780");
    expect(container.textContent).toContain("Span U3Bhbjox");
    expect(container.textContent).not.toContain("spanId");
    expect(container.textContent).not.toContain("spanNodeId");

    const links = Array.from(container.querySelectorAll("a"));
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe(
      "/redirects/spans/abcdef0123456780"
    );
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noreferrer");
    }
  });

  it("collapses long pending annotation lists behind an explicit toggle", () => {
    renderPendingAnnotations([0, 1, 2, 3, 4, 5].map(createAnnotation));

    expect(container.textContent).toContain("abcdef...6780");
    expect(container.textContent).toContain("abcdef...6783");
    expect(container.textContent).not.toContain("abcdef...6784");
    expect(container.textContent).toContain("Show 2 more");

    click(
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Show 2 more")
      ) ?? null
    );

    expect(container.textContent).toContain("abcdef...6784");
    expect(container.textContent).toContain("abcdef...6785");
    expect(container.textContent).toContain("Show fewer");
  });
});
