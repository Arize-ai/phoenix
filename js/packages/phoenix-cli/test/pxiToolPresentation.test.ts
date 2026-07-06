import { describe, expect, it } from "vitest";

import {
  getClampedLines,
  getToolPresentation,
} from "../src/pxi/toolPresentation";

describe("getToolPresentation", () => {
  describe("bash", () => {
    it("previews the summary while the command is still streaming", () => {
      const presentation = getToolPresentation({
        toolName: "bash",
        state: "input-streaming",
        input: { summary: "Run the unit test suite" },
        output: undefined,
      });
      expect(presentation.icon).toBe("$");
      expect(presentation.previewText).toBe("Run the unit test suite");
      expect(presentation.detailLines).toEqual([]);
      expect(presentation.errorLines).toEqual([]);
      expect(presentation.statusSuffix).toBeUndefined();
    });

    it("falls back to the first command line when no summary exists", () => {
      const presentation = getToolPresentation({
        toolName: "bash",
        state: "input-available",
        input: { command: "pnpm test\npnpm build" },
        output: undefined,
      });
      expect(presentation.previewText).toBe("pnpm test");
      expect(presentation.detailLines).toEqual(["pnpm test", "pnpm build"]);
    });

    it("truncates long commands to a few lines with an overflow sentinel", () => {
      const command = ["one", "two", "three", "four", "five"].join("\n");
      const presentation = getToolPresentation({
        toolName: "bash",
        state: "input-available",
        input: { summary: "Run several commands", command },
        output: undefined,
      });
      expect(presentation.detailLines).toEqual([
        "one",
        "two",
        "three",
        "… (+2 more lines)",
      ]);
    });

    it("surfaces a non-zero exit code and a stderr excerpt", () => {
      const presentation = getToolPresentation({
        toolName: "bash",
        state: "output-available",
        input: {
          summary: "Install a dependency",
          command: "pnpm add left-pad",
        },
        output: {
          stdout: "",
          stderr: "ERR_PNPM_ADDING_TO_ROOT\nsecond line\nthird line",
          exit_code: 1,
        },
      });
      expect(presentation.statusSuffix).toBe("exit 1");
      expect(presentation.errorLines).toEqual([
        "ERR_PNPM_ADDING_TO_ROOT",
        "second line",
        "… (+1 more line)",
      ]);
    });

    it("shows no suffix or error lines on a zero exit code", () => {
      const presentation = getToolPresentation({
        toolName: "bash",
        state: "output-available",
        input: { summary: "List files", command: "ls" },
        output: { stdout: "file.txt", stderr: "", exit_code: 0 },
      });
      expect(presentation.statusSuffix).toBeUndefined();
      expect(presentation.errorLines).toEqual([]);
    });
  });

  describe("generic fallback", () => {
    it("prefers known preview fields in priority order", () => {
      const presentation = getToolPresentation({
        toolName: "phoenix_graphql",
        state: "output-available",
        input: { query: "{ projects { id } }", variables: "{}" },
        output: { data: {} },
      });
      expect(presentation.icon).toBe("◆");
      expect(presentation.previewText).toBe("{ projects { id } }");
    });

    it("scans leading entries for any string when no known field matches", () => {
      const presentation = getToolPresentation({
        toolName: "list_datasets",
        state: "input-available",
        input: { limit: 10, cursor: "abc123" },
        output: undefined,
      });
      expect(presentation.previewText).toBe("abc123");
    });

    it("uses a string input directly", () => {
      const presentation = getToolPresentation({
        toolName: "some_tool",
        state: "input-available",
        input: "plain text input",
        output: undefined,
      });
      expect(presentation.previewText).toBe("plain text input");
    });

    it("collapses newlines in previews to single spaces", () => {
      const presentation = getToolPresentation({
        toolName: "some_tool",
        state: "input-available",
        input: { summary: "first line\n  second line" },
        output: undefined,
      });
      expect(presentation.previewText).toBe("first line second line");
    });

    it("clamps overlong previews with an ellipsis", () => {
      const presentation = getToolPresentation({
        toolName: "some_tool",
        state: "input-available",
        input: { summary: "x".repeat(500) },
        output: undefined,
      });
      expect(presentation.previewText).toHaveLength(121);
      expect(presentation.previewText.endsWith("…")).toBe(true);
    });

    it.each([
      ["undefined", undefined],
      ["null", null],
      ["an array", ["a", "b"]],
      ["a number", 42],
    ])("yields an empty preview for %s input without throwing", (_, input) => {
      const presentation = getToolPresentation({
        toolName: "some_tool",
        state: "input-streaming",
        input,
        output: undefined,
      });
      expect(presentation.previewText).toBe("");
    });

    it("folds the part's error text into error lines", () => {
      const presentation = getToolPresentation({
        toolName: "some_tool",
        state: "output-error",
        input: { query: "q" },
        output: undefined,
        errorText: "boom\nstack line 1",
      });
      expect(presentation.errorLines).toEqual(["boom", "stack line 1"]);
    });
  });

  describe("web_search", () => {
    it.each([
      [{ query: "phoenix tracing" }],
      [{ q: "phoenix tracing" }],
      [{ search_query: "phoenix tracing" }],
      [{ queries: ["phoenix tracing", "other"] }],
    ])("previews the query from %o", (input) => {
      const presentation = getToolPresentation({
        toolName: "web_search",
        state: "input-available",
        input,
        output: undefined,
      });
      expect(presentation.icon).toBe("⌕");
      expect(presentation.previewText).toBe("phoenix tracing");
    });

    it("labels typed non-search actions with their target", () => {
      const presentation = getToolPresentation({
        toolName: "web_search",
        state: "input-available",
        input: { type: "web_page_read", url: "https://example.com" },
        output: undefined,
      });
      expect(presentation.previewText).toBe(
        "Web Page Read: https://example.com"
      );
    });
  });

  it("previews the target url for web_fetch", () => {
    const presentation = getToolPresentation({
      toolName: "web_fetch",
      state: "input-available",
      input: { url: "https://example.com/docs" },
      output: undefined,
    });
    expect(presentation.icon).toBe("↓");
    expect(presentation.previewText).toBe("https://example.com/docs");
  });

  it("previews the subagent name for call_subagent", () => {
    const presentation = getToolPresentation({
      toolName: "call_subagent",
      state: "input-available",
      input: { name: "trace-analyzer", prompt: "look at this" },
      output: undefined,
    });
    expect(presentation.icon).toBe("◇");
    expect(presentation.previewText).toBe("trace-analyzer");
  });

  describe("load_skill", () => {
    it("is not quiet while running", () => {
      const presentation = getToolPresentation({
        toolName: "load_skill",
        state: "input-available",
        input: { skill_name: "datasets" },
        output: undefined,
      });
      expect(presentation.icon).toBe("✦");
      expect(presentation.previewText).toBe("datasets");
      expect(presentation.isQuiet).toBe(false);
    });

    it("collapses to a quiet labeled line once complete", () => {
      const presentation = getToolPresentation({
        toolName: "load_skill",
        state: "output-available",
        input: { skill_name: "datasets" },
        output: { content: "…" },
      });
      expect(presentation.isQuiet).toBe(true);
      expect(presentation.quietLabel).toBe("Loaded skill datasets");
    });

    it("uses a generic quiet label when the skill name is unavailable", () => {
      const presentation = getToolPresentation({
        toolName: "load_skill",
        state: "output-available",
        input: {},
        output: { content: "…" },
      });
      expect(presentation.quietLabel).toBe("Loaded skill");
    });
  });

  describe("read_skill_resource", () => {
    it("previews the skill and resource while running, without quieting", () => {
      const presentation = getToolPresentation({
        toolName: "read_skill_resource",
        state: "input-available",
        input: { skill_name: "datasets", resource_name: "query-guide" },
        output: undefined,
      });
      expect(presentation.icon).toBe("✦");
      expect(presentation.previewText).toBe("datasets/query-guide");
      expect(presentation.isQuiet).toBe(false);
    });

    it("previews the skill name alone while the resource is still streaming", () => {
      const presentation = getToolPresentation({
        toolName: "read_skill_resource",
        state: "input-streaming",
        input: { skill_name: "datasets" },
        output: undefined,
      });
      expect(presentation.previewText).toBe("datasets");
    });

    it("collapses to a quiet labeled line once complete", () => {
      const presentation = getToolPresentation({
        toolName: "read_skill_resource",
        state: "output-available",
        input: { skill_name: "datasets", resource_name: "query-guide" },
        output: { content: "…" },
      });
      expect(presentation.isQuiet).toBe(true);
      expect(presentation.quietLabel).toBe(
        "Read skill resource datasets/query-guide"
      );
    });

    it("uses a generic quiet label when the input is unavailable", () => {
      const presentation = getToolPresentation({
        toolName: "read_skill_resource",
        state: "output-available",
        input: undefined,
        output: { content: "…" },
      });
      expect(presentation.quietLabel).toBe("Read skill resource");
    });
  });
});

describe("getClampedLines", () => {
  it("keeps short text intact and skips blank lines", () => {
    expect(getClampedLines({ text: "a\n\nb\n", maxLines: 3 })).toEqual([
      "a",
      "b",
    ]);
  });

  it("clamps individual line length", () => {
    const [line] = getClampedLines({ text: "y".repeat(500), maxLines: 1 });
    expect(line).toHaveLength(201);
    expect(line.endsWith("…")).toBe(true);
  });

  it("marks source truncation even when line count fits", () => {
    const text = `${"z".repeat(2000)}`;
    const lines = getClampedLines({ text, maxLines: 5 });
    expect(lines.at(-1)).toBe("…");
  });
});
