import {
  getFilteredSlashMenuItems,
  getActiveQuery,
  getSelectedTokenNames,
  isSameActiveQuery,
} from "../usePromptSkillCommand";

const skills = [
  {
    name: "debug-trace",
    summary: "Debug a trace",
    description: "Debug a trace",
  },
  {
    name: "compare",
    summary: "Compare things",
    description: "Compare things",
  },
];

const commands = [
  {
    name: "clear",
    summary: "Clear the conversation",
    run: vi.fn(),
  },
];

describe("getActiveQuery", () => {
  it("detects a query when the caret is right after a leading slash", () => {
    // value: "/deb", caret at end
    expect(getActiveQuery("/deb", 4)).toEqual({
      slashIndex: 0,
      caret: 4,
      replacementEnd: 4,
      query: "deb",
    });
  });

  it("detects a bare slash trigger with an empty query", () => {
    expect(getActiveQuery("/", 1)).toEqual({
      slashIndex: 0,
      caret: 1,
      replacementEnd: 1,
      query: "",
    });
  });

  it("detects a query after whitespace mid-message", () => {
    const value = "help /ann";
    expect(getActiveQuery(value, value.length)).toEqual({
      slashIndex: 5,
      caret: 9,
      replacementEnd: 9,
      query: "ann",
    });
  });

  it("includes trailing skill characters in the replacement range", () => {
    expect(getActiveQuery("/debug-trace", 4)).toEqual({
      slashIndex: 0,
      caret: 4,
      replacementEnd: 12,
      query: "deb",
    });
  });

  it("returns null when the slash does not follow whitespace", () => {
    expect(getActiveQuery("path/to", 7)).toBeNull();
  });

  it("returns null when whitespace separates the slash from the caret", () => {
    // The query ends at the space, so a caret past it is not in a query.
    expect(getActiveQuery("/debug now", 10)).toBeNull();
  });

  it("returns null when there is no slash before the caret", () => {
    expect(getActiveQuery("just text", 9)).toBeNull();
  });
});

describe("isSameActiveQuery", () => {
  it("is true for identical queries with different replacement ranges", () => {
    expect(
      isSameActiveQuery(
        { slashIndex: 0, caret: 4, replacementEnd: 4, query: "deb" },
        // Same slash + text, even if the replacement range changed.
        { slashIndex: 0, caret: 4, replacementEnd: 12, query: "deb" }
      )
    ).toBe(true);
  });

  it("is false when the query text changes (resets selection)", () => {
    expect(
      isSameActiveQuery(
        { slashIndex: 0, caret: 4, replacementEnd: 4, query: "deb" },
        { slashIndex: 0, caret: 5, replacementEnd: 5, query: "debu" }
      )
    ).toBe(false);
  });

  it("is false when the slash position changes (new trigger)", () => {
    expect(
      isSameActiveQuery(
        { slashIndex: 0, caret: 4, replacementEnd: 4, query: "deb" },
        { slashIndex: 6, caret: 10, replacementEnd: 10, query: "deb" }
      )
    ).toBe(false);
  });

  it("is false when either side is null", () => {
    expect(
      isSameActiveQuery(null, {
        slashIndex: 0,
        caret: 1,
        replacementEnd: 1,
        query: "",
      })
    ).toBe(false);
    expect(
      isSameActiveQuery(
        { slashIndex: 0, caret: 1, replacementEnd: 1, query: "" },
        null
      )
    ).toBe(false);
  });
});

describe("getSelectedTokenNames", () => {
  const availableSkillNames = new Set(["debug-trace", "annotate-spans"]);

  it("returns known skill tokens already present in the prompt", () => {
    expect(
      getSelectedTokenNames(
        "/debug-trace compare this",
        availableSkillNames,
        null
      )
    ).toEqual(new Set(["debug-trace"]));
  });

  it("ignores unknown slash tokens", () => {
    expect(
      getSelectedTokenNames(
        "/unknown /annotate-spans",
        availableSkillNames,
        null
      )
    ).toEqual(new Set(["annotate-spans"]));
  });

  it("excludes the active token being edited", () => {
    expect(
      getSelectedTokenNames(
        "/debug-trace /annotate-spans",
        availableSkillNames,
        {
          slashIndex: 13,
          caret: 17,
          replacementEnd: 28,
          query: "ann",
        }
      )
    ).toEqual(new Set(["debug-trace"]));
  });
});

describe("getFilteredSlashMenuItems", () => {
  it("ranks executable command prefix matches before skill substring matches", () => {
    expect(
      getFilteredSlashMenuItems({
        skills,
        commands,
        query: "c",
        selectedNames: new Set(),
        canShowCommands: true,
      }).map((item) => item.name)
    ).toEqual(["compare", "clear", "debug-trace"]);
  });

  it("hides commands when the slash query is not in executable position", () => {
    expect(
      getFilteredSlashMenuItems({
        skills,
        commands,
        query: "c",
        selectedNames: new Set(),
        canShowCommands: false,
      }).map((item) => item.name)
    ).toEqual(["compare", "debug-trace"]);
  });
});
