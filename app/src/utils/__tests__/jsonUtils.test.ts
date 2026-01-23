import {
  formatContentAsString,
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

describe("formatContentAsString", () => {
  it("should return unknown json content as a string", () => {
    const content = "Hello, world!";
    expect(formatContentAsString(content)).toBe('"Hello, world!"');
    const content2 = ".123";
    expect(formatContentAsString(content2)).toBe('".123"');
    const content3 = "True";
    expect(formatContentAsString(content3)).toBe('"True"');
    const content4 = "False";
    expect(formatContentAsString(content4)).toBe('"False"');
    const content5 = "Null";
    expect(formatContentAsString(content5)).toBe('"Null"');
    const content6 = "a";
    expect(formatContentAsString(content6)).toBe('"a"');
    const content7 = "u";
    expect(formatContentAsString(content7)).toBe('"u"');
  });

  it("should return the content as a stringified JSON with pretty printing if it is an object", () => {
    const content = { foo: "bar" };
    expect(formatContentAsString(content)).toBe(
      JSON.stringify(content, null, 2)
    );
  });

  it("should return the content as a string if it is a number", () => {
    const content = 123;
    expect(formatContentAsString(content)).toBe("123");
    const content2 = 123.456;
    expect(formatContentAsString(content2)).toBe("123.456");
    const content3 = -123.456;
    expect(formatContentAsString(content3)).toBe("-123.456");
    const content4 = 0;
    expect(formatContentAsString(content4)).toBe("0");
    const content6 = 0.5;
    expect(formatContentAsString(content6)).toBe("0.5");
  });

  it("should return the content as a string if it is a boolean", () => {
    const content = true;
    expect(formatContentAsString(content)).toBe("true");
    const content2 = false;
    expect(formatContentAsString(content2)).toBe("false");
  });

  it("should return the content as a string if it is null", () => {
    const content = null;
    expect(formatContentAsString(content)).toBe("null");
  });

  it("should return the content as a string if it is an array", () => {
    const content = [1, "2", 3, { foo: "bar" }];
    expect(formatContentAsString(content)).toBe(
      `[
  1,
  "2",
  3,
  {
    "foo": "bar"
  }
]`
    );
  });

  it("should handle double quoted strings", () => {
    const content = `"\\"Hello, world!\\""`;
    expect(formatContentAsString(content)).toBe(`"Hello, world!"`);
  });
});
