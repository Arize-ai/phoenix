import {
  parsePromptParams,
  PromptParam,
  setPromptParams,
} from "../playgroundURLSearchParamsUtils";

describe("parsePromptParams", () => {
  it("returns an empty array when no promptId params are present", () => {
    const searchParams = new URLSearchParams();
    expect(parsePromptParams(searchParams)).toEqual([]);
  });

  it("returns an empty array for an unrelated query string", () => {
    const searchParams = new URLSearchParams("datasetId=abc&splitId=s1");
    expect(parsePromptParams(searchParams)).toEqual([]);
  });

  it("parses a single prompt with all three params", () => {
    const searchParams = new URLSearchParams(
      "promptId=P1&promptVersionId=V1&promptTagName=production"
    );
    expect(parsePromptParams(searchParams)).toEqual([
      { promptId: "P1", promptVersionId: "V1", tagName: "production" },
    ]);
  });

  it("parses a single prompt with only promptId", () => {
    const searchParams = new URLSearchParams("promptId=P1");
    expect(parsePromptParams(searchParams)).toEqual([
      { promptId: "P1", promptVersionId: null, tagName: null },
    ]);
  });

  it("parses multiple prompts in order (compare mode)", () => {
    const searchParams = new URLSearchParams(
      "promptId=P1&promptId=P2&promptVersionId=V1&promptVersionId=V2&promptTagName=prod&promptTagName=staging"
    );
    expect(parsePromptParams(searchParams)).toEqual([
      { promptId: "P1", promptVersionId: "V1", tagName: "prod" },
      { promptId: "P2", promptVersionId: "V2", tagName: "staging" },
    ]);
  });

  it("treats empty string version/tag as null", () => {
    const searchParams = new URLSearchParams(
      "promptId=P1&promptVersionId=&promptTagName="
    );
    expect(parsePromptParams(searchParams)).toEqual([
      { promptId: "P1", promptVersionId: null, tagName: null },
    ]);
  });

  it("handles missing version/tag arrays for later positions", () => {
    const searchParams = new URLSearchParams(
      "promptId=P1&promptId=P2&promptVersionId=V1"
    );
    expect(parsePromptParams(searchParams)).toEqual([
      { promptId: "P1", promptVersionId: "V1", tagName: null },
      { promptId: "P2", promptVersionId: null, tagName: null },
    ]);
  });

  it("preserves other search params (does not consume them)", () => {
    const searchParams = new URLSearchParams(
      "datasetId=DS1&promptId=P1&splitId=S1"
    );
    const result = parsePromptParams(searchParams);
    expect(result).toEqual([
      { promptId: "P1", promptVersionId: null, tagName: null },
    ]);
    // Original params are not modified
    expect(searchParams.get("datasetId")).toBe("DS1");
    expect(searchParams.get("splitId")).toBe("S1");
  });
});

describe("setPromptParams", () => {
  it("returns false and makes no changes when params already match", () => {
    const searchParams = new URLSearchParams(
      "promptId=P1&promptVersionId=V1&promptTagName=prod"
    );
    const prompts: PromptParam[] = [
      { promptId: "P1", promptVersionId: "V1", tagName: "prod" },
    ];
    const changed = setPromptParams(searchParams, prompts);
    expect(changed).toBe(false);
    expect(searchParams.getAll("promptId")).toEqual(["P1"]);
    expect(searchParams.getAll("promptVersionId")).toEqual(["V1"]);
    expect(searchParams.getAll("promptTagName")).toEqual(["prod"]);
  });

  it("returns true and sets params when they differ", () => {
    const searchParams = new URLSearchParams();
    const prompts: PromptParam[] = [
      { promptId: "P1", promptVersionId: "V1", tagName: "prod" },
    ];
    const changed = setPromptParams(searchParams, prompts);
    expect(changed).toBe(true);
    expect(searchParams.getAll("promptId")).toEqual(["P1"]);
    expect(searchParams.getAll("promptVersionId")).toEqual(["V1"]);
    expect(searchParams.getAll("promptTagName")).toEqual(["prod"]);
  });

  it("clears existing prompt params when given an empty array", () => {
    const searchParams = new URLSearchParams(
      "promptId=P1&promptVersionId=V1&promptTagName=prod"
    );
    const changed = setPromptParams(searchParams, []);
    expect(changed).toBe(true);
    expect(searchParams.getAll("promptId")).toEqual([]);
    expect(searchParams.getAll("promptVersionId")).toEqual([]);
    expect(searchParams.getAll("promptTagName")).toEqual([]);
  });

  it("preserves non-prompt search params", () => {
    const searchParams = new URLSearchParams("datasetId=DS1&splitId=S1");
    const prompts: PromptParam[] = [
      { promptId: "P1", promptVersionId: "V1", tagName: null },
    ];
    setPromptParams(searchParams, prompts);
    expect(searchParams.get("datasetId")).toBe("DS1");
    expect(searchParams.get("splitId")).toBe("S1");
    expect(searchParams.getAll("promptId")).toEqual(["P1"]);
  });

  it("sets multiple prompts in order", () => {
    const searchParams = new URLSearchParams();
    const prompts: PromptParam[] = [
      { promptId: "P1", promptVersionId: "V1", tagName: "prod" },
      { promptId: "P2", promptVersionId: "V2", tagName: null },
    ];
    setPromptParams(searchParams, prompts);
    expect(searchParams.getAll("promptId")).toEqual(["P1", "P2"]);
    expect(searchParams.getAll("promptVersionId")).toEqual(["V1", "V2"]);
    expect(searchParams.getAll("promptTagName")).toEqual(["prod", ""]);
  });

  it("converts null version/tag to empty string", () => {
    const searchParams = new URLSearchParams();
    const prompts: PromptParam[] = [
      { promptId: "P1", promptVersionId: null, tagName: null },
    ];
    setPromptParams(searchParams, prompts);
    expect(searchParams.getAll("promptVersionId")).toEqual([""]);
    expect(searchParams.getAll("promptTagName")).toEqual([""]);
  });

  it("replaces existing prompts when the set changes", () => {
    const searchParams = new URLSearchParams(
      "promptId=OLD&promptVersionId=V_OLD&promptTagName=old_tag"
    );
    const prompts: PromptParam[] = [
      { promptId: "NEW", promptVersionId: "V_NEW", tagName: "new_tag" },
    ];
    const changed = setPromptParams(searchParams, prompts);
    expect(changed).toBe(true);
    expect(searchParams.getAll("promptId")).toEqual(["NEW"]);
    expect(searchParams.getAll("promptVersionId")).toEqual(["V_NEW"]);
    expect(searchParams.getAll("promptTagName")).toEqual(["new_tag"]);
  });

  it("returns false when clearing already-empty params", () => {
    const searchParams = new URLSearchParams("datasetId=DS1");
    const changed = setPromptParams(searchParams, []);
    expect(changed).toBe(false);
  });
});
