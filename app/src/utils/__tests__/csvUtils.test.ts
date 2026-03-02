import { parseCSVRow, parseCSVColumns, removeBOM } from "../csvUtils";

describe("removeBOM", () => {
  it("removes BOM from start of string", () => {
    expect(removeBOM("\uFEFFhello")).toBe("hello");
  });

  it("leaves strings without BOM unchanged", () => {
    expect(removeBOM("hello")).toBe("hello");
    expect(removeBOM("")).toBe("");
  });
});

describe("parseCSVRow", () => {
  it("parses simple unquoted fields", () => {
    expect(parseCSVRow("a,b,c")).toEqual(["a", "b", "c"]);
    expect(parseCSVRow("hello,world")).toEqual(["hello", "world"]);
  });

  it("trims whitespace from fields", () => {
    expect(parseCSVRow("  a  ,  b  ,  c  ")).toEqual(["a", "b", "c"]);
  });

  it("handles empty fields", () => {
    expect(parseCSVRow("a,,c")).toEqual(["a", "", "c"]);
    expect(parseCSVRow(",b,")).toEqual(["", "b", ""]);
    expect(parseCSVRow(",,")).toEqual(["", "", ""]);
  });

  it("handles quoted fields", () => {
    expect(parseCSVRow('"hello","world"')).toEqual(["hello", "world"]);
    expect(parseCSVRow('"a",b,"c"')).toEqual(["a", "b", "c"]);
  });

  it("handles commas within quoted fields", () => {
    expect(parseCSVRow('"hello, world",foo')).toEqual(["hello, world", "foo"]);
    expect(parseCSVRow('a,"b,c,d",e')).toEqual(["a", "b,c,d", "e"]);
  });

  it("handles escaped quotes within quoted fields", () => {
    expect(parseCSVRow('"say ""hello""",world')).toEqual([
      'say "hello"',
      "world",
    ]);
    expect(parseCSVRow('"""quoted"""')).toEqual(['"quoted"']);
    expect(parseCSVRow('"a""b"')).toEqual(['a"b']);
  });

  it("handles complex mixed cases", () => {
    expect(parseCSVRow('"Name, First",Age,"City ""Big"" Town"')).toEqual([
      "Name, First",
      "Age",
      'City "Big" Town',
    ]);
  });

  it("handles single field", () => {
    expect(parseCSVRow("hello")).toEqual(["hello"]);
    expect(parseCSVRow('"hello"')).toEqual(["hello"]);
  });

  it("handles empty string", () => {
    expect(parseCSVRow("")).toEqual([""]);
  });
});

describe("parseCSVColumns", () => {
  it("parses header row from CSV text", () => {
    expect(parseCSVColumns("a,b,c\n1,2,3\n4,5,6")).toEqual(["a", "b", "c"]);
  });

  it("handles Windows line endings", () => {
    expect(parseCSVColumns("a,b,c\r\n1,2,3\r\n4,5,6")).toEqual(["a", "b", "c"]);
  });

  it("handles BOM at start of file", () => {
    expect(parseCSVColumns("\uFEFFa,b,c\n1,2,3")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted column names", () => {
    expect(parseCSVColumns('"Column A","Column, B"\n1,2')).toEqual([
      "Column A",
      "Column, B",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(parseCSVColumns("")).toEqual([]);
  });

  it("handles single line CSV (header only)", () => {
    expect(parseCSVColumns("a,b,c")).toEqual(["a", "b", "c"]);
  });
});
