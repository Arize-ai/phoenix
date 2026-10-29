import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { replaceWhitespaceWithDashes } from "@phoenix/utils/identifierUtils";

import { transformInputValue } from "../transformInputValue";

describe("transformInputValue", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    document.body.appendChild(input);
  });

  afterEach(() => {
    input.remove();
  });

  /**
   * Simulates the browser state after a keystroke or paste: the focused input
   * holds `value` with the caret at `caret` when the change handler runs.
   */
  function type(value: string, caret: number) {
    input.focus();
    input.value = value;
    input.setSelectionRange(caret, caret);
    return transformInputValue(value, replaceWhitespaceWithDashes);
  }

  it("should keep the caret after a space typed mid-word", () => {
    expect(type("a bc", 2)).toBe("a-bc");
    expect(input.value).toBe("a-bc");
    expect(input.selectionStart).toBe(2);
  });

  it("should place the caret after a collapsed pasted run of whitespace", () => {
    expect(type("my   \tname-tag", 10)).toBe("my-name-tag");
    expect(input.selectionStart).toBe(7);
  });

  it("should not touch the input when it holds a different value", () => {
    input.focus();
    input.value = "typed";
    input.setSelectionRange(2, 2);
    expect(transformInputValue("my prompt", replaceWhitespaceWithDashes)).toBe(
      "my-prompt"
    );
    expect(input.value).toBe("typed");
    expect(input.selectionStart).toBe(2);
  });

  it("should still transform when no input is focused", () => {
    expect(transformInputValue("my tag", replaceWhitespaceWithDashes)).toBe(
      "my-tag"
    );
  });
});
