import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { READ_PROMPT_TOOL_NAME } from "@phoenix/agent/tools/playgroundPrompt";
import { AgentProvider } from "@phoenix/contexts/AgentContext";

vi.mock("@phoenix/components/code", () => ({
  CodeBlock: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  CodeWrap: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  JSONEditor: () => null,
}));

vi.mock("@phoenix/components/code/JSONEditor", () => ({
  JSONEditor: () => null,
}));

vi.mock("@phoenix/components/markdown", () => ({
  MarkdownBlock: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

import { ChatScrollContext } from "../ChatScrollContext";
import { getToolPartPreview, ToolPart } from "../ToolPart";
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
    type: `tool-${READ_PROMPT_TOOL_NAME}`,
    toolCallId: "tool-call-1",
    state: "output-available",
    input: {},
    output: "done",
    errorText: undefined,
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

function click(element: Element | null) {
  expect(element).not.toBeNull();
  act(() => {
    element!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("tool disclosure controls", () => {
  it("previews native web search queries", () => {
    expect(
      getToolPartPreview(
        createToolPart({
          type: "dynamic-tool",
          toolName: "web_search",
          input: { query: "phoenix pxi web search" },
        } as Partial<ToolInvocationPart>)
      )
    ).toBe("phoenix pxi web search");

    expect(
      getToolPartPreview(
        createToolPart({
          type: "dynamic-tool",
          toolName: "web_search",
          input: { queries: ["first query", "second query"] },
        } as Partial<ToolInvocationPart>)
      )
    ).toBe("first query");

    expect(
      getToolPartPreview(
        createToolPart({
          type: "dynamic-tool",
          toolName: "web_search",
          input: {
            type: "open_page",
            url: "https://ai.google.dev/gemini-api/docs/models",
          },
        } as Partial<ToolInvocationPart>)
      )
    ).toBe("Open Page: https://ai.google.dev/gemini-api/docs/models");
  });

  it("previews native web fetch urls", () => {
    expect(
      getToolPartPreview(
        createToolPart({
          type: "dynamic-tool",
          toolName: "web_fetch",
          input: { url: "https://example.com/docs" },
        } as Partial<ToolInvocationPart>)
      )
    ).toBe("https://example.com/docs");
  });

  it("does not render empty subagent message parts under nested tools", () => {
    renderToolPart(
      createToolPart({
        type: "tool-call_subagent",
        toolCallId: "tool-call-subagent",
        input: { name: "Phoenix data", task: "Summarize latency" },
        output: {
          summary: "Done",
          message: {
            id: "subagent-message",
            role: "assistant",
            parts: [
              {
                type: "tool-bash",
                toolCallId: "tool-call-bash",
                state: "output-available",
                input: { command: "echo hi" },
                output: "hi",
              },
              {
                type: "reasoning",
                text: "",
                state: "done",
              },
              {
                type: "text",
                text: "   ",
                state: "done",
              },
              {
                type: "text",
                text: "Visible answer",
                state: "done",
              },
            ],
          },
        },
      })
    );

    click(container.querySelector("summary"));

    expect(container.textContent).toContain("Visible answer");
    expect(container.textContent).not.toContain("(empty)");
  });

  it("stops stick-to-bottom when a scroll-into-view tool auto-opens", () => {
    // Regression: when an `execute_browser_action` call auto-opened for an
    // approval, the scroll-into-view ran while the stick-to-bottom controller
    // was still animating toward the bottom. The two fought — the approval
    // card stalled half clipped and the transcript stopped responding to the
    // user's scrolling. The auto-open effect must release the controller
    // before scrolling the card into view.
    const stopScroll = vi.fn();
    act(() => {
      root.render(
        <AgentProvider>
          <ChatScrollContext.Provider
            value={{ stopScroll, scrollToBottom: vi.fn() }}
          >
            <ToolPart
              part={createToolPart({
                type: "tool-execute_browser_action",
                toolCallId: "tool-call-browser-action",
                state: "approval-requested",
                input: { summary: "Edit the draft", script: "return 1;" },
                output: undefined,
              })}
            />
          </ChatScrollContext.Provider>
        </AgentProvider>
      );
    });

    expect(stopScroll).toHaveBeenCalled();
    // The card auto-opened for the approval.
    expect(container.querySelector("details")?.open).toBe(true);
  });
});
