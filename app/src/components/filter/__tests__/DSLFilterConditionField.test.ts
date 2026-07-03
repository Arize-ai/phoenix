import { describe, expect, it } from "vitest";

import {
  getDSLFilterCompletionTokenBeforeCursor,
  shouldSuppressDSLFilterCompletionsInString,
} from "../dslFilterConditionFieldUtils";

describe("DSLFilterConditionField completion helpers", () => {
  it("includes quoted subscripts with spaces in the replacement token", () => {
    const textBeforeCursor = "annotations['Human Fee";
    const token = getDSLFilterCompletionTokenBeforeCursor(textBeforeCursor);

    expect(token).toEqual({
      from: 0,
      to: textBeforeCursor.length,
      text: textBeforeCursor,
    });
    expect(
      shouldSuppressDSLFilterCompletionsInString({
        textBeforeCursor,
        tokenFrom: token.from,
      })
    ).toBe(false);
  });

  it("includes integer-indexed attribute paths in the replacement token", () => {
    const textBeforeCursor =
      "attributes['llm']['input_messages'][0]['message']['role";

    expect(getDSLFilterCompletionTokenBeforeCursor(textBeforeCursor)).toEqual({
      from: 0,
      to: textBeforeCursor.length,
      text: textBeforeCursor,
    });
  });

  it("includes trailing member-access dots in the replacement token", () => {
    expect(getDSLFilterCompletionTokenBeforeCursor("input.")).toEqual({
      from: 0,
      to: "input.".length,
      text: "input.",
    });
    expect(
      getDSLFilterCompletionTokenBeforeCursor("annotations['quality'].")
    ).toEqual({
      from: 0,
      to: "annotations['quality'].".length,
      text: "annotations['quality'].",
    });
  });

  it("suppresses field completions inside ordinary string values", () => {
    const textBeforeCursor =
      "attributes['input']['mime_type'] == 'application/js";
    const token = getDSLFilterCompletionTokenBeforeCursor(textBeforeCursor);

    expect(token.text).toBe("js");
    expect(
      shouldSuppressDSLFilterCompletionsInString({
        textBeforeCursor,
        tokenFrom: token.from,
      })
    ).toBe(true);
  });

  it("does not suppress completions after a closed string value", () => {
    const textBeforeCursor = "span_kind == 'LLM' and sta";
    const token = getDSLFilterCompletionTokenBeforeCursor(textBeforeCursor);

    expect(token.text).toBe("sta");
    expect(
      shouldSuppressDSLFilterCompletionsInString({
        textBeforeCursor,
        tokenFrom: token.from,
      })
    ).toBe(false);
  });
});
