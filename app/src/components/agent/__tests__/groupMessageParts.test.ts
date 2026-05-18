import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { JSON_RENDER_DATA_PART_TYPE } from "@phoenix/components/agent/generativeUICatalog";

import { groupMessageParts } from "../groupMessageParts";

function createGeneratedUIPart({
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

describe("groupMessageParts", () => {
  it("creates a render slot for each generated UI part", () => {
    const firstPart = createGeneratedUIPart({ title: "First chart" });
    const secondPart = createGeneratedUIPart({ title: "Second chart" });

    const grouped = groupMessageParts([firstPart, secondPart]);

    expect(grouped).toEqual([
      { kind: "generative-ui", part: firstPart, index: 0 },
      { kind: "generative-ui", part: secondPart, index: 1 },
    ]);
  });

  it("keeps streaming generated UI tool calls as tool parts", () => {
    const streamingToolPart = {
      type: "tool-render_generated_ui",
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

    const grouped = groupMessageParts([streamingToolPart]);

    expect(grouped).toEqual([
      { kind: "tool-solo", part: streamingToolPart, index: 0 },
    ]);
  });

  it("does not treat invalid completed generated UI tool calls as render slots", () => {
    const firstPart = createGeneratedUIPart({ title: "First chart" });
    const invalidStackedToolPart = {
      type: "tool-render_generated_ui",
      toolCallId: "tool-call-invalid-stacked",
      state: "output-available",
      output: "Generated UI rendered in chat.",
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
    const secondPart = createGeneratedUIPart({ title: "Second chart" });

    const grouped = groupMessageParts([
      firstPart,
      invalidStackedToolPart,
      secondPart,
    ]);

    expect(grouped).toEqual([
      { kind: "generative-ui", part: firstPart, index: 0 },
      { kind: "tool-solo", part: invalidStackedToolPart, index: 1 },
      { kind: "generative-ui", part: secondPart, index: 2 },
    ]);
  });
});
