import {
  findCompleteCSVRowEnd,
  parseCSVFile,
  parseCSVRow,
  removeBOM,
} from "../csvUtils";

/**
 * Helper to create a File object from a string for testing streaming functions.
 * Includes a polyfill for File.stream() which is not available in all test environments.
 */
function createFile(content: string, name = "test.csv"): File {
  const file = new File([content], name, { type: "text/csv" });

  // Polyfill stream() for test environment
  if (!file.stream) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    (file as { stream: () => ReadableStream<Uint8Array> }).stream = () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });
  }

  return file;
}

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

describe("parseCSVFile", () => {
  it("parses header row, preview rows, and total count", async () => {
    const file = createFile("a,b,c\n1,2,3\n4,5,6\n7,8,9");
    const result = await parseCSVFile(file);
    expect(result.columns).toEqual(["a", "b", "c"]);
    expect(result.previewRows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
    ]);
    expect(result.totalRowCount).toBe(3);
  });

  it("handles Windows line endings", async () => {
    const file = createFile("a,b,c\r\n1,2,3\r\n4,5,6");
    const result = await parseCSVFile(file);
    expect(result.columns).toEqual(["a", "b", "c"]);
    expect(result.previewRows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
    expect(result.totalRowCount).toBe(2);
  });

  it("handles BOM at start of file", async () => {
    const file = createFile("\uFEFFa,b,c\n1,2,3");
    const result = await parseCSVFile(file);
    expect(result.columns).toEqual(["a", "b", "c"]);
    expect(result.previewRows).toEqual([["1", "2", "3"]]);
  });

  it("handles quoted column names", async () => {
    const file = createFile('"Column A","Column, B"\n1,2');
    const result = await parseCSVFile(file);
    expect(result.columns).toEqual(["Column A", "Column, B"]);
  });

  it("handles quoted column names containing newlines", async () => {
    const file = createFile('"Column\nA","Column B"\n1,2');
    const result = await parseCSVFile(file);
    expect(result.columns).toEqual(["Column\nA", "Column B"]);
  });

  it("throws for empty input", async () => {
    const file = createFile("");
    await expect(parseCSVFile(file)).rejects.toThrow("CSV file is empty");
  });

  it("handles single line CSV (header only)", async () => {
    const file = createFile("a,b,c");
    const result = await parseCSVFile(file);
    expect(result.columns).toEqual(["a", "b", "c"]);
    expect(result.previewRows).toEqual([]);
    expect(result.totalRowCount).toBe(0);
  });

  it("limits preview rows to maxPreviewRows", async () => {
    const rows = ["a,b,c"];
    for (let i = 0; i < 20; i++) {
      rows.push(`${i},${i + 1},${i + 2}`);
    }
    const file = createFile(rows.join("\n"));
    const result = await parseCSVFile(file, 5);
    expect(result.previewRows.length).toBe(5);
    expect(result.totalRowCount).toBe(20);
  });

  it("counts all rows even when limiting preview", async () => {
    const rows = ["header"];
    for (let i = 0; i < 100; i++) {
      rows.push(`row${i}`);
    }
    const file = createFile(rows.join("\n"));
    const result = await parseCSVFile(file, 3);
    expect(result.previewRows.length).toBe(3);
    expect(result.totalRowCount).toBe(100);
  });

  it("handles file without trailing newline", async () => {
    const file = createFile("a,b\n1,2\n3,4");
    const result = await parseCSVFile(file);
    expect(result.columns).toEqual(["a", "b"]);
    expect(result.previewRows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
    expect(result.totalRowCount).toBe(2);
  });
});

describe("findCompleteCSVRowEnd", () => {
  it("finds newline in simple row", () => {
    expect(findCompleteCSVRowEnd("a,b,c\n1,2,3")).toBe(5);
  });

  it("finds Windows line ending", () => {
    expect(findCompleteCSVRowEnd("a,b,c\r\n1,2,3")).toBe(5);
  });

  it("returns -1 when no complete row", () => {
    expect(findCompleteCSVRowEnd("a,b,c")).toBe(-1);
  });

  it("ignores newlines inside quoted fields", () => {
    expect(findCompleteCSVRowEnd('"hello\nworld",foo\nbar')).toBe(17);
  });

  it("handles escaped quotes in quoted fields", () => {
    expect(findCompleteCSVRowEnd('"say ""hi""",foo\nbar')).toBe(16);
  });

  it("returns -1 when row has unclosed quote", () => {
    expect(findCompleteCSVRowEnd('"unclosed,field')).toBe(-1);
  });
});
