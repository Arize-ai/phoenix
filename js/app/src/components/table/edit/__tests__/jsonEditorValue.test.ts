import {
  formatJSONEditorValue,
  getJSONEditorInitialCursor,
} from "../jsonEditorValue";

describe("formatJSONEditorValue", () => {
  it("pretty prints objects", () => {
    expect(formatJSONEditorValue({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it("opens an empty object with a line to type on", () => {
    expect(formatJSONEditorValue({})).toBe("{\n  \n}");
    expect(JSON.parse(formatJSONEditorValue({}))).toEqual({});
  });

  it("returns an empty string for undefined", () => {
    expect(formatJSONEditorValue(undefined)).toBe("");
  });
});

describe("getJSONEditorInitialCursor", () => {
  it("lands inside the first empty string", () => {
    const text = formatJSONEditorValue({ role: "", content: "" });
    const cursor = getJSONEditorInitialCursor(text);
    expect(text.slice(cursor - 1, cursor + 1)).toBe('""');
    expect(text.indexOf('""')).toBe(cursor - 1);
  });

  it("lands on the empty line of an empty object", () => {
    const text = formatJSONEditorValue({});
    const cursor = getJSONEditorInitialCursor(text);
    expect(text.slice(0, cursor)).toBe("{\n  ");
  });

  it("starts at the top when there is nothing blank", () => {
    expect(getJSONEditorInitialCursor('{\n  "a": 1\n}')).toBe(0);
  });
});
