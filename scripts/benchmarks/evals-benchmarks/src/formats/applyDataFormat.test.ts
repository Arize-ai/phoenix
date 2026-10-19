import type { PromptTemplate } from "@arizeai/phoenix-evals";
import { describe, expect, it } from "vitest";

import { applyDataFormat } from "./applyDataFormat.js";

const TEXT_TEMPLATE: PromptTemplate = [
  {
    role: "user",
    content: `Rubric here.

<data>
<text>
{{text}}
</text>
</data>

Is it toxic?
`,
  },
];

describe("applyDataFormat", () => {
  it("returns the template and record unchanged for default", () => {
    const record = { text: "hello" };
    const formatted = applyDataFormat({
      promptTemplate: TEXT_TEMPLATE,
      record,
      dataFormat: "default",
    });
    expect(formatted.promptTemplate).toBe(TEXT_TEMPLATE);
    expect(formatted.record).toBe(record);
  });

  it("puts a JSON blob in the data slot for json", () => {
    const record = { text: "hello" };
    const formatted = applyDataFormat({
      promptTemplate: TEXT_TEMPLATE,
      record,
      dataFormat: "json",
    });
    const content =
      Array.isArray(formatted.promptTemplate) &&
      typeof formatted.promptTemplate[0]?.content === "string"
        ? formatted.promptTemplate[0].content
        : "";
    expect(content).toContain("<data>\n{{json}}\n</data>");
    expect(content).not.toMatch(/<data>[\s\S]*\{\{text\}\}[\s\S]*<\/data>/);
    expect(formatted.record).toEqual({ json: JSON.stringify(record) });
  });

  it("splits rubric to system and JSON to user for messages", () => {
    const record = { text: "hello" };
    const formatted = applyDataFormat({
      promptTemplate: TEXT_TEMPLATE,
      record,
      dataFormat: "messages",
    });
    expect(Array.isArray(formatted.promptTemplate)).toBe(true);
    if (!Array.isArray(formatted.promptTemplate)) {
      throw new Error("expected message list");
    }
    expect(formatted.promptTemplate).toHaveLength(2);
    expect(formatted.promptTemplate[0]?.role).toBe("system");
    expect(formatted.promptTemplate[0]?.content).toContain("Rubric here.");
    expect(formatted.promptTemplate[0]?.content).toContain("Is it toxic?");
    expect(formatted.promptTemplate[0]?.content).not.toContain("<data>");
    expect(formatted.promptTemplate[1]).toEqual({
      role: "user",
      content: "{{json}}",
    });
    expect(formatted.record).toEqual({ json: JSON.stringify(record) });
  });

  it("throws when the template has no data block", () => {
    expect(() =>
      applyDataFormat({
        promptTemplate: [{ role: "user", content: "no data tags {{text}}" }],
        record: { text: "hello" },
        dataFormat: "json",
      })
    ).toThrow(/<data>/);
  });

  it("throws on unknown formats", () => {
    expect(() =>
      applyDataFormat({
        promptTemplate: TEXT_TEMPLATE,
        record: { text: "hello" },
        dataFormat: "raw",
      })
    ).toThrow(/Unknown data format/);
  });
});
