import { describe, it, expect } from "vitest";
import { INSIGHT_SYSTEM_PROMPT } from "../../src/prompts/system.js";

describe("system-prompt", () => {
  describe("INSIGHT_SYSTEM_PROMPT", () => {
    it("should export the system prompt as a string", () => {
      expect(typeof INSIGHT_SYSTEM_PROMPT).toBe("string");
      expect(INSIGHT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it("should start with the correct introduction", () => {
      expect(INSIGHT_SYSTEM_PROMPT).toMatch(
        /^You are an expert at analyzing Phoenix observability data\./
      );
    });

    it("should instruct to read _context.md first", () => {
      expect(INSIGHT_SYSTEM_PROMPT).toContain(
        "**START by reading /phoenix/_context.md**"
      );
      expect(INSIGHT_SYSTEM_PROMPT).toContain(
        "it contains a summary of what's available"
      );
    });

    it("should describe the filesystem structure", () => {
      expect(INSIGHT_SYSTEM_PROMPT).toContain("/phoenix/");
      expect(INSIGHT_SYSTEM_PROMPT).toContain("_context.md");
      expect(INSIGHT_SYSTEM_PROMPT).toContain("/projects/{name}/spans/");
      expect(INSIGHT_SYSTEM_PROMPT).toContain("/datasets/");
      expect(INSIGHT_SYSTEM_PROMPT).toContain("/experiments/");
      expect(INSIGHT_SYSTEM_PROMPT).toContain("/prompts/");
    });

    it("should list available bash commands", () => {
      const commands = [
        "cat",
        "head",
        "tail",
        "grep",
        "jq",
        "ls",
        "find",
        "sort",
        "uniq",
        "wc",
        "awk",
      ];
      commands.forEach((cmd) => {
        expect(INSIGHT_SYSTEM_PROMPT).toContain(cmd);
      });
    });

    it("should mention px-fetch-more commands", () => {
      expect(INSIGHT_SYSTEM_PROMPT).toContain("px-fetch-more spans");
      expect(INSIGHT_SYSTEM_PROMPT).toContain("px-fetch-more trace");
      expect(INSIGHT_SYSTEM_PROMPT).toContain("--project <name>");
      expect(INSIGHT_SYSTEM_PROMPT).toContain("--trace-id <id>");
    });

    it("should emphasize that it's a read-only snapshot", () => {
      expect(INSIGHT_SYSTEM_PROMPT).toContain("READ-ONLY snapshot");
    });

    it("should include descriptions for each file type", () => {
      expect(INSIGHT_SYSTEM_PROMPT).toContain(
        "Span data (JSONL format, may be sampled)"
      );
      expect(INSIGHT_SYSTEM_PROMPT).toContain("Datasets and examples");
      expect(INSIGHT_SYSTEM_PROMPT).toContain("Experiment runs and results");
      expect(INSIGHT_SYSTEM_PROMPT).toContain("Prompt templates and versions");
    });
  });
});
