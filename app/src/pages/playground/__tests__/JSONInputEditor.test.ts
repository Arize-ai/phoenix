import { describe, expect, it, vi } from "vitest";

// Mock the JSONEditor component to avoid CodeMirror dependency issues in tests
vi.mock("@phoenix/components/code/JSONEditor", () => ({
  JSONEditor: vi.fn(() => null),
}));

vi.mock("@phoenix/components", () => ({
  Label: vi.fn(() => null),
}));

vi.mock("@phoenix/components/code", () => ({
  CodeWrap: vi.fn(() => null),
}));

vi.mock("@phoenix/components/field/styles", () => ({
  fieldBaseCSS: {},
}));

import { JSONInputEditor } from "../JSONInputEditor";

describe("JSONInputEditor", () => {
  it("should accept value and onChange props", () => {
    const mockOnChange = vi.fn();
    const testValue = '{"key": "value"}';

    // This test verifies the component accepts the expected props
    // The component is a thin wrapper around JSONEditor
    expect(() => {
      JSONInputEditor({ value: testValue, onChange: mockOnChange });
    }).not.toThrow();
  });

  it("should handle empty value", () => {
    const mockOnChange = vi.fn();

    expect(() => {
      JSONInputEditor({ value: "", onChange: mockOnChange });
    }).not.toThrow();
  });
});
