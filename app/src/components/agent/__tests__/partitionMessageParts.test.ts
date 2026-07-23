import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { JSON_RENDER_DATA_PART_TYPE } from "@phoenix/components/agent/generativeUICatalog";

import { partitionMessageParts } from "../partitionMessageParts";

function createBashPart(toolCallId: string): UIMessage["parts"][number] {
  return {
    type: "tool-bash",
    toolCallId,
    state: "output-available",
    input: { command: "echo hi" },
    output: "hi",
  } as UIMessage["parts"][number];
}

function createToolPart(
  type: string,
  toolCallId: string
): UIMessage["parts"][number] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fixture factory coerces a loose literal into the message part union
  return {
    type,
    toolCallId,
    state: "output-available",
    input: {},
    output: "done",
  } as UIMessage["parts"][number];
}

function createGenerativeUIPart({
  title,
}: {
  title: string;
}): UIMessage["parts"][number] {
  return {
    type: JSON_RENDER_DATA_PART_TYPE,
    data: {
      type: "flat",
      spec: {
        root: "chart",
        elements: {
          chart: {
            type: "BarChart",
            props: {
              title,
              data: [
                { label: "Count", value: 1 },
                { label: "Errors", value: 0 },
              ],
            },
            children: [],
          },
        },
      },
      state: {},
    },
  } as UIMessage["parts"][number];
}

describe("partitionMessageParts", () => {
  describe("tool parts", () => {
    it("renders each tool call individually, including bash", () => {
      const first = createBashPart("bash-1");
      const second = createBashPart("bash-2");
      const third = createBashPart("bash-3");

      const segments = partitionMessageParts([first, second, third]);

      expect(segments).toEqual([
        { kind: "tool-solo", part: first, index: 0 },
        { kind: "tool-solo", part: second, index: 1 },
        { kind: "tool-solo", part: third, index: 2 },
      ]);
    });

    it("renders skill loads and sub-agent calls individually", () => {
      const loadSkill = createToolPart("tool-load_skill", "skill-1");
      const subagent = createToolPart("tool-call_subagent", "subagent-1");

      const segments = partitionMessageParts([loadSkill, subagent]);

      expect(segments).toEqual([
        { kind: "tool-solo", part: loadSkill, index: 0 },
        { kind: "tool-solo", part: subagent, index: 1 },
      ]);
    });

    it("skips hidden parts between tool calls and preserves original indexes", () => {
      const first = createBashPart("bash-1");
      const reasoningPart = {
        type: "reasoning",
        text: "Thinking about the next command.",
        state: "done",
      } as UIMessage["parts"][number];
      const stepStart = {
        type: "step-start",
      } as UIMessage["parts"][number];
      const second = createBashPart("bash-2");

      const segments = partitionMessageParts([
        first,
        reasoningPart,
        stepStart,
        second,
      ]);

      expect(segments).toEqual([
        { kind: "tool-solo", part: first, index: 0 },
        { kind: "tool-solo", part: second, index: 3 },
      ]);
    });
  });

  describe("text", () => {
    it("classifies visible text interleaved with tool calls", () => {
      const bash1 = createBashPart("bash-1");
      const text = {
        type: "text",
        text: "Here is what I found.",
      } as UIMessage["parts"][number];
      const bash2 = createBashPart("bash-2");

      const segments = partitionMessageParts([bash1, text, bash2]);

      expect(segments).toEqual([
        { kind: "tool-solo", part: bash1, index: 0 },
        { kind: "text", part: text, index: 1 },
        { kind: "tool-solo", part: bash2, index: 2 },
      ]);
    });

    it("skips whitespace-only text parts", () => {
      const blank = {
        type: "text",
        text: "   ",
      } as UIMessage["parts"][number];
      const bash = createBashPart("bash-1");

      const segments = partitionMessageParts([blank, bash]);

      expect(segments).toEqual([{ kind: "tool-solo", part: bash, index: 1 }]);
    });
  });

  describe("generative UI", () => {
    it("creates a render slot for each generative UI part", () => {
      const firstPart = createGenerativeUIPart({ title: "First chart" });
      const secondPart = createGenerativeUIPart({ title: "Second chart" });

      const segments = partitionMessageParts([firstPart, secondPart]);

      expect(segments).toEqual([
        { kind: "generative-ui", part: firstPart, index: 0 },
        { kind: "generative-ui", part: secondPart, index: 1 },
      ]);
    });

    it("creates a render slot for streaming generative UI tool calls", () => {
      const streamingToolPart = {
        type: "tool-render_generative_ui",
        toolCallId: "tool-call-1",
        state: "input-streaming",
        input: {
          spec: {
            root: "chart",
            elements: {
              chart: {
                type: "BarChart",
                props: { title: "Streaming", data: [{ label: "A", value: 1 }] },
                children: [],
              },
            },
          },
        },
      } as UIMessage["parts"][number];

      const segments = partitionMessageParts([streamingToolPart]);

      expect(segments).toEqual([
        { kind: "generative-ui", part: streamingToolPart, index: 0 },
      ]);
    });

    it("keeps failed generative UI tool calls as tool parts", () => {
      const failedToolPart = {
        type: "tool-render_generative_ui",
        toolCallId: "tool-call-1",
        state: "output-error",
        input: undefined,
        errorText: "I couldn't render that generative UI.",
      } as UIMessage["parts"][number];

      const segments = partitionMessageParts([failedToolPart]);

      expect(segments).toEqual([
        { kind: "tool-solo", part: failedToolPart, index: 0 },
      ]);
    });

    it("does not treat invalid completed generative UI tool calls as render slots", () => {
      const firstPart = createGenerativeUIPart({ title: "First chart" });
      const invalidStackedToolPart = {
        type: "tool-render_generative_ui",
        toolCallId: "tool-call-invalid-stacked",
        state: "output-available",
        output: "Generative UI rendered in chat.",
        input: {
          spec: {
            root: "stacked",
            elements: {
              stacked: {
                type: "StackedBarChart",
                props: {
                  title: "Stacked Bar Chart — Token Usage by Model",
                  data: [
                    {
                      label: "gpt-4o",
                      segments: [
                        { label: "Prompt", value: 12500 },
                        { label: "Completion", value: 8200 },
                        {},
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      } as UIMessage["parts"][number];
      const secondPart = createGenerativeUIPart({ title: "Second chart" });

      const segments = partitionMessageParts([
        firstPart,
        invalidStackedToolPart,
        secondPart,
      ]);

      expect(segments).toEqual([
        { kind: "generative-ui", part: firstPart, index: 0 },
        { kind: "tool-solo", part: invalidStackedToolPart, index: 1 },
        { kind: "generative-ui", part: secondPart, index: 2 },
      ]);
    });
  });
});
