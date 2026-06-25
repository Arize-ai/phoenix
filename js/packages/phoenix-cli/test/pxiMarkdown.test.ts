import { describe, expect, it } from "vitest";

import { formatMarkdownForTerminal } from "../src/pxi/markdown";

describe("formatMarkdownForTerminal", () => {
  it("formats markdown pipe tables as terminal tables", () => {
    const formatted = formatMarkdownForTerminal({
      text: [
        "Here are the projects:",
        "",
        "| Name | Traces |",
        "| --- | ---: |",
        "| default | 12 |",
        "| staging | 3 |",
      ].join("\n"),
      maxWidth: 80,
    });

    expect(formatted).toContain("Here are the projects:");
    expect(formatted).toContain("┌");
    expect(formatted).toContain("│ Name");
    expect(formatted).toContain("│ default");
    expect(formatted).not.toContain("| --- |");
  });

  it("renders markdown lists without raw markdown markers", () => {
    const formatted = formatMarkdownForTerminal({
      text: "- one\n- two",
      maxWidth: 80,
    });

    expect(formatted).toContain("one");
    expect(formatted).toContain("two");
    expect(formatted).not.toContain("- one");
  });
});
