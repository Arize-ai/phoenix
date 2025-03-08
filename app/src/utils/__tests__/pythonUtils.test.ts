import { toPythonPrimitiveStr } from "../pythonUtils";

describe("toPythonPrimitiveStr", () => {
  it("should preserve strings", () => {
    expect(toPythonPrimitiveStr("hello")).toEqual(`"hello"`);
    expect(toPythonPrimitiveStr("hello\nworld")).toEqual(`"hello\\nworld"`);
    expect(toPythonPrimitiveStr('hello"world')).toEqual(`"hello\\"world"`);
    expect(toPythonPrimitiveStr('hello\nworld"')).toEqual(`"hello\\nworld\\""`);
  });
});
