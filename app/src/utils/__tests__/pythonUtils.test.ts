import { toPythonPrimitiveStr } from "../pythonUtils";

describe("toPythonPrimitiveStr", () => {
  it("should convert booleans to Python format", () => {
    expect(toPythonPrimitiveStr(true)).toEqual("True");
    expect(toPythonPrimitiveStr(false)).toEqual("False");
  });

  it("should convert numbers to strings", () => {
    expect(toPythonPrimitiveStr(42)).toEqual("42");
    expect(toPythonPrimitiveStr(3.14)).toEqual("3.14");
  });

  it("should escape newlines and quotes in strings", () => {
    expect(toPythonPrimitiveStr("hello\nworld")).toEqual(`"hello\\nworld"`);
    expect(toPythonPrimitiveStr('say "hello"')).toEqual(`"say \\"hello\\""`);
  });

  it("should escape backslashes in Windows file paths", () => {
    const input = "C:\\Users\\Alice\\Documents\\report.pdf";
    expect(toPythonPrimitiveStr(input)).toEqual(
      `"C:\\\\Users\\\\Alice\\\\Documents\\\\report.pdf"`
    );
  });

  it("should escape backslashes in regex patterns", () => {
    const input = "\\d{3}-\\d{2}-\\d{4}";
    expect(toPythonPrimitiveStr(input)).toEqual(`"\\\\d{3}-\\\\d{2}-\\\\d{4}"`);
  });

  it("should distinguish literal backslash-n from actual newline", () => {
    // Actual newline character
    expect(toPythonPrimitiveStr("line1\nline2")).toEqual(`"line1\\nline2"`);

    // Literal backslash followed by 'n'
    expect(toPythonPrimitiveStr("path\\name")).toEqual(`"path\\\\name"`);
  });

  it("should handle strings with backslashes, newlines, and quotes", () => {
    const input = 'C:\\Users\\"test"\npath';
    expect(toPythonPrimitiveStr(input)).toEqual(
      `"C:\\\\Users\\\\\\"test\\"\\npath"`
    );
  });
});
