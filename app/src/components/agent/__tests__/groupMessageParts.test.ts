import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { JSON_RENDER_DATA_PART_TYPE } from "@phoenix/components/agent/generativeUICatalog";

import { groupMessageParts } from "../groupMessageParts";

function createGeneratedUIPart({
  text,
}: {
  text: string;
}): UIMessage["parts"][number] {
  return {
    type: JSON_RENDER_DATA_PART_TYPE,
    data: {
      type: "flat",
      spec: {
        root: "title",
        elements: {
          title: {
            type: "Title",
            props: { text },
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
    const firstPart = createGeneratedUIPart({ text: "First chart" });
    const secondPart = createGeneratedUIPart({ text: "Second chart" });

    const grouped = groupMessageParts([firstPart, secondPart]);

    expect(grouped).toEqual([
      { kind: "generative-ui", part: firstPart, index: 0 },
      { kind: "generative-ui", part: secondPart, index: 1 },
    ]);
  });
});
