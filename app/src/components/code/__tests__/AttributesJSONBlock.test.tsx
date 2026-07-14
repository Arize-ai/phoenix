import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

import { Card } from "@phoenix/components";
import {
  AttributesJSONBlock,
  AttributesJSONBlockControls,
  AttributesJSONBlockProvider,
  formatValue,
  hasStringifiedJSON,
} from "@phoenix/components/code/AttributesJSONBlock";

vi.mock("../JSONBlock", () => ({
  JSONBlock: ({ value }: { value: string }) => (
    <pre data-testid="json-block">{value}</pre>
  ),
}));

vi.mock("@phoenix/components/core/copy", () => ({
  CopyToClipboardButton: ({ text }: { text: string }) => (
    <button type="button" aria-label="Copy" data-copy-text={text}>
      Copy
    </button>
  ),
}));

describe("formatValue", () => {
  it("parses stringified objects", () => {
    expect(formatValue('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses objects with string values", () => {
    expect(formatValue('{"a": "b"}')).toEqual({ a: "b" });
  });

  it("parses stringified arrays", () => {
    expect(formatValue("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("parses arrays of objects", () => {
    expect(formatValue('[{"a": 1}, {"b": 2}]')).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("parses nested JSON in objects", () => {
    expect(formatValue({ nested: '{"a": 1}' })).toEqual({
      nested: { a: 1 },
    });
  });

  it("parses nested JSON in arrays", () => {
    expect(formatValue(['{"a": 1}', '{"b": 2}'])).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("parses deeply nested structures", () => {
    expect(
      formatValue({
        key1: '{"a": 1}',
        key2: { nested: '{"b": 2}' },
      })
    ).toEqual({
      key1: { a: 1 },
      key2: { nested: { b: 2 } },
    });
  });

  it("handles mixed structures", () => {
    expect(
      formatValue({
        stringified: '{"a": 1}',
        array: ['{"b": 2}', 3],
        nested: { deep: '["x", "y"]' },
      })
    ).toEqual({
      stringified: { a: 1 },
      array: [{ b: 2 }, 3],
      nested: { deep: ["x", "y"] },
    });
  });

  it("preserves non-JSON strings", () => {
    expect(formatValue("not json")).toBe("not json");
    expect(formatValue("123")).toBe("123");
    expect(formatValue("true")).toBe("true");
  });

  it("preserves primitive values", () => {
    expect(formatValue(123)).toBe(123);
    expect(formatValue(true)).toBe(true);
    expect(formatValue(null)).toBe(null);
  });

  it("preserves already parsed objects", () => {
    const input = [{ a: 1 }, { b: 2 }];
    expect(formatValue(input)).toEqual(input);
  });
});

describe("AttributesJSONBlock", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderAttributes(attributes: string) {
    act(() => {
      root.render(
        <AttributesJSONBlockProvider attributes={attributes}>
          <Card
            title="All Attributes"
            collapsible
            extra={<AttributesJSONBlockControls />}
          >
            <AttributesJSONBlock />
          </Card>
        </AttributesJSONBlockProvider>
      );
    });
  }

  it("renders JSON values with controls only in the card header", () => {
    const attributes = JSON.stringify({ count: 1, enabled: true });
    renderAttributes(attributes);

    const header = container.querySelector("header");
    const body = container.querySelector(".card__body");

    expect(header?.querySelector('[aria-label="Copy"]')).not.toBeNull();
    expect(header?.querySelector('[aria-label="Expand Strings"]')).toBeNull();
    expect(body?.querySelector("button")).toBeNull();
    expect(body?.querySelector('[data-testid="json-block"]')?.textContent).toBe(
      JSON.stringify({ count: 1, enabled: true }, null, 2)
    );
  });

  it("expands and collapses JSON-encoded strings from the card header", () => {
    const attributes = JSON.stringify({ nested: '{"value": 1}' });
    renderAttributes(attributes);

    const header = container.querySelector("header");
    const body = container.querySelector(".card__body");
    const expandButton = header?.querySelector<HTMLButtonElement>(
      '[aria-label="Expand Strings"]'
    );

    expect(expandButton).not.toBeNull();
    expect(body?.querySelector("button")).toBeNull();
    expect(body?.querySelector('[data-testid="json-block"]')?.textContent).toBe(
      JSON.stringify({ nested: '{"value": 1}' }, null, 2)
    );

    act(() => {
      expandButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const expandedValue = JSON.stringify({ nested: { value: 1 } }, null, 2);
    expect(
      header?.querySelector('[aria-label="Collapse Strings"]')
    ).not.toBeNull();
    expect(container.querySelector("section")?.dataset.collapsed).toBe("false");
    expect(body?.querySelector('[data-testid="json-block"]')?.textContent).toBe(
      expandedValue
    );
    expect(
      header
        ?.querySelector('[aria-label="Copy"]')
        ?.getAttribute("data-copy-text")
    ).toBe(expandedValue);

    const collapseButton = header?.querySelector<HTMLButtonElement>(
      '[aria-label="Collapse Strings"]'
    );
    act(() => {
      collapseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      header?.querySelector('[aria-label="Expand Strings"]')
    ).not.toBeNull();
    expect(body?.querySelector('[data-testid="json-block"]')?.textContent).toBe(
      JSON.stringify({ nested: '{"value": 1}' }, null, 2)
    );
  });

  it("renders non-JSON values unchanged without an expand control", () => {
    const attributes = "not JSON";
    renderAttributes(attributes);

    const header = container.querySelector("header");
    const body = container.querySelector(".card__body");

    expect(header?.querySelector('[aria-label="Expand Strings"]')).toBeNull();
    expect(
      header
        ?.querySelector('[aria-label="Copy"]')
        ?.getAttribute("data-copy-text")
    ).toBe(attributes);
    expect(body?.querySelector("button")).toBeNull();
    expect(body?.querySelector('[data-testid="pre-block"]')?.textContent).toBe(
      attributes
    );
    expect(body?.querySelector('[data-testid="json-block"]')).toBeNull();
  });
});

describe("hasStringifiedJSON", () => {
  describe("returns true for", () => {
    it("stringified objects", () => {
      expect(hasStringifiedJSON('{"a": 1}')).toBe(true);
    });

    it("nested stringified objects", () => {
      expect(hasStringifiedJSON('{"a": {"b": 1}}')).toBe(true);
    });

    it("stringified arrays", () => {
      expect(hasStringifiedJSON("[1, 2, 3]")).toBe(true);
    });

    it("stringified arrays of objects", () => {
      expect(hasStringifiedJSON('[{"a": 1}]')).toBe(true);
    });

    it("arrays containing JSON strings", () => {
      expect(hasStringifiedJSON(['{"a": 1}'])).toBe(true);
    });

    it("arrays with mixed JSON strings", () => {
      expect(hasStringifiedJSON([1, 2, '{"a": 1}'])).toBe(true);
    });

    it("objects with JSON string values", () => {
      expect(hasStringifiedJSON({ key: '{"a": 1}' })).toBe(true);
    });

    it("deeply nested JSON strings", () => {
      expect(hasStringifiedJSON({ nested: { deep: '{"a": 1}' } })).toBe(true);
    });
  });

  describe("returns false for", () => {
    it("non-JSON strings", () => {
      expect(hasStringifiedJSON("plain string")).toBe(false);
      expect(hasStringifiedJSON("123")).toBe(false);
      expect(hasStringifiedJSON("true")).toBe(false);
      expect(hasStringifiedJSON("null")).toBe(false);
    });

    it("primitive values", () => {
      expect(hasStringifiedJSON(123)).toBe(false);
      expect(hasStringifiedJSON(true)).toBe(false);
      expect(hasStringifiedJSON(null)).toBe(false);
    });

    it("objects without stringified JSON", () => {
      expect(hasStringifiedJSON({ a: 1 })).toBe(false);
      expect(hasStringifiedJSON({ a: { b: 1 } })).toBe(false);
    });

    it("arrays without stringified JSON", () => {
      expect(hasStringifiedJSON([1, 2, 3])).toBe(false);
      expect(hasStringifiedJSON([{ a: 1 }])).toBe(false);
    });

    it("invalid or malformed JSON strings", () => {
      expect(hasStringifiedJSON("{invalid}")).toBe(false);
      expect(hasStringifiedJSON("[1, 2,")).toBe(false);
    });
  });
});
