import { buildAnnotationConfigInput } from "../buildAnnotationConfigInput";
import {
  parseCreateAnnotationConfigInput,
  parseUpdateAnnotationConfigInput,
} from "../parsers";

describe("create_annotation_config input parser", () => {
  it("parses a categorical config with values and projectId", () => {
    const result = parseCreateAnnotationConfigInput({
      type: "categorical",
      name: "tool_selection",
      values: [{ label: "correct" }, { label: "incorrect", score: 0 }],
      projectId: "UHJvamVjdDox",
    });
    expect(result?.type).toBe("categorical");
    expect(result?.name).toBe("tool_selection");
    expect(result?.values).toHaveLength(2);
    expect(result?.projectId).toBe("UHJvamVjdDox");
  });

  it("trims the name and allows omitting optional fields", () => {
    const result = parseCreateAnnotationConfigInput({
      type: "freeform",
      name: "  notes_quality  ",
    });
    expect(result?.name).toBe("notes_quality");
    expect(result?.projectId).toBeUndefined();
  });

  it("rejects a missing/empty name or unknown type", () => {
    expect(
      parseCreateAnnotationConfigInput({ type: "categorical", name: "" })
    ).toBeNull();
    expect(
      parseCreateAnnotationConfigInput({ type: "bogus", name: "x" })
    ).toBeNull();
    expect(parseCreateAnnotationConfigInput(null)).toBeNull();
  });
});

describe("update_annotation_config input parser", () => {
  it("requires an id plus the full config", () => {
    const result = parseUpdateAnnotationConfigInput({
      id: "QW5ub3RhdGlvbkNvbmZpZzox",
      type: "categorical",
      name: "tool_selection",
      values: [
        { label: "correct" },
        { label: "incorrect" },
        { label: "partial" },
      ],
    });
    expect(result?.id).toBe("QW5ub3RhdGlvbkNvbmZpZzox");
    expect(result?.values).toHaveLength(3);
  });

  it("rejects an update with no id", () => {
    expect(
      parseUpdateAnnotationConfigInput({ type: "categorical", name: "x" })
    ).toBeNull();
  });
});

describe("buildAnnotationConfigInput", () => {
  it("maps a categorical draft onto the categorical one-of, defaulting direction to NONE", () => {
    const input = buildAnnotationConfigInput({
      type: "categorical",
      name: "tool_selection",
      values: [{ label: "correct" }, { label: "incorrect", score: 0 }],
    });
    expect(input).toEqual({
      categorical: {
        name: "tool_selection",
        description: null,
        optimizationDirection: "NONE",
        values: [
          { label: "correct", score: null },
          { label: "incorrect", score: 0 },
        ],
      },
    });
  });

  it("maps a continuous draft with bounds and an explicit direction", () => {
    const input = buildAnnotationConfigInput({
      type: "continuous",
      name: "helpfulness",
      optimizationDirection: "MAXIMIZE",
      lowerBound: 0,
      upperBound: 1,
    });
    expect(input).toEqual({
      continuous: {
        name: "helpfulness",
        description: null,
        optimizationDirection: "MAXIMIZE",
        lowerBound: 0,
        upperBound: 1,
      },
    });
  });

  it("maps a freeform draft with a threshold", () => {
    const input = buildAnnotationConfigInput({
      type: "freeform",
      name: "notes",
      threshold: 0.5,
    });
    expect(input).toEqual({
      freeform: {
        name: "notes",
        description: null,
        optimizationDirection: "NONE",
        threshold: 0.5,
        lowerBound: null,
        upperBound: null,
      },
    });
  });
});
