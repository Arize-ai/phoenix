import { describe, expect, it } from "vitest";

import { withRepresentableContentOnly } from "@phoenix/pages/prompt/media/representableContent";
import { promptMessageToOpenAI } from "@phoenix/schemas/messageSchemas";

const TEXT_PART = {
  __typename: "TextContentPart",
  text: { text: "describe this" },
};

/**
 * The export's query selects only text, tool calls and tool results, so a media
 * part reaches this code as an empty object.
 */
const UNSELECTED_MEDIA_PART = {};

describe("withRepresentableContentOnly", () => {
  it("keeps a message whose media part the export cannot represent", () => {
    const message = {
      role: "USER",
      content: [TEXT_PART, UNSELECTED_MEDIA_PART],
    };

    // Without the filter the whole message is rejected, which is the bug: the
    // caller catches, logs, and drops it, so the text disappears from the snippet
    // along with the image.
    expect(promptMessageToOpenAI.safeParse(message).success).toBe(false);

    const filtered = withRepresentableContentOnly(message);
    const parsed = promptMessageToOpenAI.safeParse(filtered);
    expect(parsed.success).toBe(true);
    expect(filtered.content).toEqual([TEXT_PART]);
  });

  it("leaves a message with nothing unrepresentable untouched", () => {
    const message = { role: "USER", content: [TEXT_PART] };
    // Same object back, so the common path allocates nothing.
    expect(withRepresentableContentOnly(message)).toBe(message);
  });

  it("passes through a message with no content array", () => {
    const message = { role: "AI", content: undefined };
    expect(withRepresentableContentOnly(message)).toBe(message);
  });
});
