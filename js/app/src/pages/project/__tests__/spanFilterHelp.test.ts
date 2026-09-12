import { describe, expect, it } from "vitest";

import { spanFilterAIQueryDSL } from "../spanFilterDSL";
import {
  formatSpanFilterExampleSummary,
  getSpanFilterHelp,
} from "../spanFilterHelp";

describe("getSpanFilterHelp", () => {
  it("is the AI query DSL, reshaped and nothing more", () => {
    const help = getSpanFilterHelp();
    expect(help.fields).toBe(spanFilterAIQueryDSL.fields);
    expect(help.examples).toBe(spanFilterAIQueryDSL.examples);
    expect(help.notes).toEqual(spanFilterAIQueryDSL.notes);
    expect(help.fields.map((field) => field.name)).toContain("llm.model_name");
  });

  it("defaults absent notes to an empty list", () => {
    expect(
      getSpanFilterHelp({ fields: [], examples: [], notes: undefined }).notes
    ).toEqual([]);
  });
});

describe("formatSpanFilterExampleSummary", () => {
  it("renders the first examples as request → expression pairs", () => {
    expect(
      formatSpanFilterExampleSummary({
        examples: [
          { description: "errors", expression: "status_code == 'ERROR'" },
          { description: "root spans", expression: "parent_id is None" },
          { description: "dropped", expression: "x" },
        ],
        limit: 2,
      })
    ).toBe("errors → status_code == 'ERROR'; root spans → parent_id is None");
  });

  it("stays a single short line for the operation description", () => {
    const summary = formatSpanFilterExampleSummary();
    expect(summary).not.toContain("\n");
    expect(summary.length).toBeLessThan(400);
  });
});
