import { isJSONObjectString } from "../jsonUtils";

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
