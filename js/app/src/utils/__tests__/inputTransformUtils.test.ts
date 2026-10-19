import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { replaceWhitespaceWithDashes } from "../identifierUtils";
import { withInputTransform } from "../inputTransformUtils";

describe("withInputTransform", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    document.body.appendChild(input);
    // Run the deferred cursor restore synchronously
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    input.remove();
    vi.restoreAllMocks();
  });

  /**
   * Simulates the browser state after a keystroke or paste: the input holds
   * `value` with the caret at `caret`, then the change handler fires. The
   * onChange mirrors a controlled input by writing the value back to the DOM.
   */
  function change(value: string, caret: number) {
    input.focus();
    input.value = value;
    input.setSelectionRange(caret, caret);
    const onChange = vi.fn((next: string) => {
      input.value = next;
    });
    withInputTransform(replaceWhitespaceWithDashes, onChange)(value);
    return onChange;
  }

  it("should pass the transformed value to onChange", () => {
    const onChange = change("my tag", 6);
    expect(onChange).toHaveBeenCalledWith("my-tag");
  });

  it("should keep the cursor after a space typed mid-word", () => {
    change("a bc", 2);
    expect(input.value).toBe("a-bc");
    expect(input.selectionStart).toBe(2);
  });

  it("should place the cursor after a collapsed pasted run of whitespace", () => {
    // "my   \tname" pasted before "-tag", caret lands at the end of the paste
    change("my   \tname-tag", 10);
    expect(input.value).toBe("my-name-tag");
    expect(input.selectionStart).toBe(7);
  });

  it("should not move the cursor when the value is unchanged", () => {
    const onChange = change("a+b", 1);
    expect(onChange).toHaveBeenCalledWith("a+b");
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("should still transform when no input is focused", () => {
    input.blur();
    const onChange = vi.fn();
    withInputTransform(replaceWhitespaceWithDashes, onChange)("my tag");
    expect(onChange).toHaveBeenCalledWith("my-tag");
  });
});
