import {
  formatMessageContent,
  isJSONObjectString,
  jsonStringToFlatObject,
} from "../jsonUtils";

describe("isJSONObjectString", () => {
  it("detects invalid JSON and JSON that's not objects", () => {
    expect(isJSONObjectString("")).toEqual(false);
    expect(isJSONObjectString("123")).toEqual(false);
    expect(isJSONObjectString("[]")).toEqual(false);
    expect(isJSONObjectString("[1, 2, 3]")).toEqual(false);
    expect(isJSONObjectString("{")).toEqual(false);
    expect(isJSONObjectString("{]")).toEqual(false);
    expect(isJSONObjectString("{1: 2}")).toEqual(false);
    expect(isJSONObjectString("{1, 2}")).toEqual(false);
    expect(isJSONObjectString("{1: 2, 3}")).toEqual(false);
  });
  it("detects valid JSON objects", () => {
    expect(isJSONObjectString("{}")).toEqual(true);
    expect(isJSONObjectString('{"a": 1}')).toEqual(true);
    expect(isJSONObjectString('{"a": "b"}')).toEqual(true);
    expect(isJSONObjectString('{"a": {"b": 1}}')).toEqual(true);
    expect(isJSONObjectString('{"a": [1, 2, 3]}')).toEqual(true);
  });
});

describe("jsonStringToFlatObject", () => {
  it("flattens objects", () => {
    expect(jsonStringToFlatObject("{}")).toEqual({});
    expect(jsonStringToFlatObject('{"a": 1}')).toEqual({ a: 1 });
    expect(jsonStringToFlatObject('{"a": {"b": 1}}')).toEqual({ "a.b": 1 });
    expect(jsonStringToFlatObject('{"a": {"b": {"c": 1}}}')).toEqual({
      "a.b.c": 1,
    });
    expect(jsonStringToFlatObject('{"a": {"b": 1}, "c": 2}')).toEqual({
      "a.b": 1,
      c: 2,
    });
  });
});

describe("formatMessageContent", () => {
  it("returns empty string for null and undefined", () => {
    expect(formatMessageContent(null)).toEqual("");
    expect(formatMessageContent(undefined)).toEqual("");
  });

  it("returns strings as-is", () => {
    expect(formatMessageContent("hello")).toEqual("hello");
    expect(formatMessageContent("")).toEqual("");
    expect(formatMessageContent("test message")).toEqual("test message");
  });

  it("serializes objects to formatted JSON", () => {
    expect(formatMessageContent({ a: 1 })).toEqual('{\n  "a": 1\n}');
    expect(formatMessageContent({ foo: "bar", baz: 123 })).toEqual(
      '{\n  "foo": "bar",\n  "baz": 123\n}'
    );
    expect(formatMessageContent({ nested: { key: "value" } })).toEqual(
      '{\n  "nested": {\n    "key": "value"\n  }\n}'
    );
  });

  it("serializes arrays to formatted JSON", () => {
    expect(formatMessageContent([1, 2, 3])).toEqual("[\n  1,\n  2,\n  3\n]");
    expect(formatMessageContent(["a", "b"])).toEqual('[\n  "a",\n  "b"\n]');
  });

  it("handles mixed content types", () => {
    expect(formatMessageContent({ accessible_by_AI: ["file1", "file2"] })).toEqual(
      '{\n  "accessible_by_AI": [\n    "file1",\n    "file2"\n  ]\n}'
    );
    expect(
      formatMessageContent({
        accessible_by_AI: ["doc1.txt", "doc2.pdf"],
        not_accessible_by_AI: ["secret.txt"],
      })
    ).toEqual(
      '{\n  "accessible_by_AI": [\n    "doc1.txt",\n    "doc2.pdf"\n  ],\n  "not_accessible_by_AI": [\n    "secret.txt"\n  ]\n}'
    );
  });

  it("falls back to String() for non-serializable values", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(formatMessageContent(circular)).toEqual("[object Object]");
  });
});
