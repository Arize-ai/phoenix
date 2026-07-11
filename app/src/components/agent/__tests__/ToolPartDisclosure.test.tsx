import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EDIT_PROMPT_TOOL_NAME,
  READ_PROMPT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";
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

function createAutoOpenToolPart(
  overrides: Partial<ToolInvocationPart> = {}
): ToolInvocationPart {
  return {
    type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
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

  it("renders read_skill_resource resource names", () => {
    const part = createToolPart({
      type: "tool-read_skill_resource",
      input: {
        skill_name: "phoenix-graphql",
        resource_name: "span-fields",
        args: { entity: "Span" },
      },
      output: "field reference content",
    });

    expect(getToolPartPreview(part)).toBe("span-fields");

    renderToolPart(part);

    expect(container.textContent).toContain("read_skill_resource");
    expect(container.textContent).toContain("phoenix-graphql");
    expect(container.textContent).toContain("span-fields");
    expect(container.textContent).toContain('"entity": "Span"');
    expect(container.textContent).toContain("field reference content");
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

  it("keeps an auto-open solo tool collapsed after streaming updates", () => {
    renderToolPart(createAutoOpenToolPart());
    const summary = container.querySelector("summary");

    expect(
      container.querySelector("details.tool-part")?.hasAttribute("open")
    ).toBe(true);

    click(summary);
    expect(
      container.querySelector("details.tool-part")?.hasAttribute("open")
    ).toBe(false);

    renderToolPart(
      createAutoOpenToolPart({
        state: "output-available",
        output: { ok: true },
      })
    );

    expect(
      container.querySelector("details.tool-part")?.hasAttribute("open")
    ).toBe(false);
  });

  it("stays collapsed while an auto-open tool's input is still streaming", () => {
    // The expanded body is built from a pending client-action that only exists
    // once the input is complete, so opening mid-stream would show an empty
    // shell. Auto-open should wait for the input to finish streaming.
    renderToolPart(createAutoOpenToolPart({ state: "input-streaming" }));

    expect(
      container.querySelector("details.tool-part")?.hasAttribute("open")
    ).toBe(false);

    // Once the input completes, the part auto-opens with real content.
    renderToolPart(createAutoOpenToolPart({ state: "input-available" }));

    expect(
      container.querySelector("details.tool-part")?.hasAttribute("open")
    ).toBe(true);
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
});
