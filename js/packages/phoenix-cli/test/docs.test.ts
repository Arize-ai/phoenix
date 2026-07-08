import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import type { DocEntry } from "../src/commands/docs";
import {
  filterByWorkflows,
  generateReadme,
  generateSectionIndex,
  groupBySection,
  parseLlmsTxt,
  urlToFilePath,
} from "../src/commands/docs";

// Read the real Phoenix llms.txt via symlink
const LLMS_TXT = readFileSync(resolve(__dirname, "fixtures/llms.txt"), "utf-8");

describe("docs", () => {
  describe("parseLlmsTxt", () => {
    it("should parse entries from real llms.txt", () => {
      const entries = parseLlmsTxt(LLMS_TXT);

      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0]).toEqual({
        title: "Main page",
        url: "https://arize.com/docs/phoenix",
        description: expect.any(String),
        section: "Overview",
      });
      // Verify we parse a reasonable number of entries
      expect(entries.length).toBeGreaterThan(50);
    });

    it("should assign subsection entries to parent ## section", () => {
      const entries = parseLlmsTxt(LLMS_TXT);
      // Entries under ### subsections should be assigned to their parent ## section
      const tracingEntries = entries.filter(
        (entry) => entry.section === "Tracing"
      );
      expect(tracingEntries.length).toBeGreaterThan(0);
    });

    it("should assign correct top-level sections", () => {
      const entries = parseLlmsTxt(LLMS_TXT);
      const sections = [...new Set(entries.map((entry) => entry.section))];

      expect(sections).toContain("Overview");
      expect(sections).toContain("Tracing");
      expect(sections).toContain("Evaluation");
      expect(sections).toContain("Datasets & Experiments");
      expect(sections).toContain("Prompt Engineering");
      expect(sections).toContain("Integrations");
      expect(sections).toContain("SDK & API Reference");
      expect(sections).toContain("Self-Hosting");
      expect(sections).toContain("Cookbooks");
    });

    it("should parse descriptions", () => {
      const entries = parseLlmsTxt(LLMS_TXT);
      expect(entries[0].description).toEqual(expect.any(String));
      expect(entries[0].description.length).toBeGreaterThan(0);
    });

    it("should handle empty content", () => {
      expect(parseLlmsTxt("")).toEqual([]);
    });

    it("should handle content with no links", () => {
      const content = "# Title\n\n## Section\n\nSome text without links.\n";
      expect(parseLlmsTxt(content)).toEqual([]);
    });

    it("should handle entries without descriptions", () => {
      const content =
        "## Section\n- [Title](https://arize.com/docs/phoenix/page)\n";
      const entries = parseLlmsTxt(content);
      expect(entries).toEqual([
        {
          title: "Title",
          url: "https://arize.com/docs/phoenix/page",
          description: "",
          section: "Section",
        },
      ]);
    });
  });

  describe("filterByWorkflows", () => {
    const entries: DocEntry[] = [
      {
        title: "LLM Traces",
        url: "https://arize.com/docs/phoenix/tracing/llm-traces",
        description: "Understanding traces",
        section: "Tracing",
      },
      {
        title: "How to Evals",
        url: "https://arize.com/docs/phoenix/evaluation/how-to-evals",
        description: "Evaluation guide",
        section: "Evaluation",
      },
      {
        title: "Manage Datasets",
        url: "https://arize.com/docs/phoenix/datasets/manage-datasets",
        description: "Dataset management",
        section: "Datasets & Experiments",
      },
      {
        title: "Docker",
        url: "https://arize.com/docs/phoenix/self-hosting/docker",
        description: "Docker deployment",
        section: "Self-Hosting",
      },
    ];

    it("should return all entries when no workflows specified", () => {
      expect(filterByWorkflows(entries, [])).toEqual(entries);
    });

    it("should return all entries for workflow 'all'", () => {
      expect(filterByWorkflows(entries, ["all"])).toEqual(entries);
    });

    it("should filter by a single workflow", () => {
      const result = filterByWorkflows(entries, ["tracing"]);
      expect(result).toEqual([entries[0]]);
    });

    it("should filter by multiple workflows", () => {
      const result = filterByWorkflows(entries, ["tracing", "evaluation"]);
      expect(result).toEqual([entries[0], entries[1]]);
    });

    it("should be case-insensitive for workflow names", () => {
      const result = filterByWorkflows(entries, ["TRACING"]);
      expect(result).toEqual([entries[0]]);
    });

    it("should handle datasets workflow mapping", () => {
      const result = filterByWorkflows(entries, ["datasets"]);
      expect(result).toEqual([entries[2]]);
    });

    it("should handle self-hosting workflow mapping", () => {
      const result = filterByWorkflows(entries, ["self-hosting"]);
      expect(result).toEqual([entries[3]]);
    });

    it("should return empty array for unknown workflow", () => {
      const result = filterByWorkflows(entries, ["nonexistent"]);
      expect(result).toEqual([]);
    });
  });

  describe("urlToFilePath", () => {
    it("should strip the Phoenix docs prefix and append .md", () => {
      const result = urlToFilePath(
        "https://arize.com/docs/phoenix/tracing/llm-traces",
        ".px/docs"
      );
      expect(result).toBe(".px/docs/tracing/llm-traces.md");
    });

    it("should handle deeply nested paths", () => {
      const result = urlToFilePath(
        "https://arize.com/docs/phoenix/evaluation/how-to/custom-evals",
        ".px/docs"
      );
      expect(result).toBe(".px/docs/evaluation/how-to/custom-evals.md");
    });

    it("should handle custom output directories", () => {
      const result = urlToFilePath(
        "https://arize.com/docs/phoenix/tracing/llm-traces",
        "/tmp/my-docs"
      );
      expect(result).toBe("/tmp/my-docs/tracing/llm-traces.md");
    });

    it("should strip trailing slashes from the URL path", () => {
      const result = urlToFilePath(
        "https://arize.com/docs/phoenix/tracing/llm-traces/",
        ".px/docs"
      );
      expect(result).toBe(".px/docs/tracing/llm-traces.md");
    });
  });

  describe("groupBySection", () => {
    it("should group entries by lowercased section", () => {
      const entries: DocEntry[] = [
        {
          title: "LLM Traces",
          url: "https://arize.com/docs/phoenix/tracing/llm-traces",
          description: "Traces",
          section: "Tracing",
        },
        {
          title: "Tutorial",
          url: "https://arize.com/docs/phoenix/tracing/tutorial",
          description: "Tutorial",
          section: "Tracing",
        },
        {
          title: "Evals",
          url: "https://arize.com/docs/phoenix/evaluation/evals",
          description: "Evals",
          section: "Evaluation",
        },
      ];

      const grouped = groupBySection(entries);
      expect(grouped.size).toBe(2);
      expect(grouped.get("tracing")?.length).toBe(2);
      expect(grouped.get("evaluation")?.length).toBe(1);
    });

    it("should return empty map for empty entries", () => {
      expect(groupBySection([]).size).toBe(0);
    });
  });

  describe("generateReadme", () => {
    it("should generate a README with sections and links", () => {
      const entries: DocEntry[] = [
        {
          title: "LLM Traces",
          url: "https://arize.com/docs/phoenix/tracing/llm-traces",
          description: "Traces",
          section: "Tracing",
        },
        {
          title: "How to Evals",
          url: "https://arize.com/docs/phoenix/evaluation/how-to-evals",
          description: "Evals",
          section: "Evaluation",
        },
      ];

      const readme = generateReadme(entries);
      expect(readme).toContain("# Phoenix Docs");
      expect(readme).toContain("Generated by `px docs fetch`.");
      expect(readme).toContain("## tracing");
      expect(readme).toContain("- [LLM Traces](tracing/llm-traces.md)");
      expect(readme).toContain("## evaluation");
      expect(readme).toContain("- [How to Evals](evaluation/how-to-evals.md)");
    });

    it("should handle empty entries", () => {
      const readme = generateReadme([]);
      expect(readme).toContain("# Phoenix Docs");
      expect(readme).not.toContain("##");
    });
  });

  describe("generateSectionIndex", () => {
    it("should generate a section index with relative links and sources", () => {
      const entries: DocEntry[] = [
        {
          title: "LLM Traces",
          url: "https://arize.com/docs/phoenix/tracing/llm-traces",
          description: "Traces",
          section: "Tracing",
        },
        {
          title: "Tutorial",
          url: "https://arize.com/docs/phoenix/tracing/tutorial",
          description: "Tutorial",
          section: "Tracing",
        },
      ];

      const index = generateSectionIndex("tracing", entries);
      expect(index).toContain("# tracing Docs");
      expect(index).toContain("- [LLM Traces](llm-traces.md)");
      expect(index).toContain(
        "  source: `https://arize.com/docs/phoenix/tracing/llm-traces.md`"
      );
      expect(index).toContain("- [Tutorial](tutorial.md)");
      expect(index).toContain(
        "  source: `https://arize.com/docs/phoenix/tracing/tutorial.md`"
      );
    });

    it("should use relative paths for nested entries within a section", () => {
      const entries: DocEntry[] = [
        {
          title: "How-to Tracing",
          url: "https://arize.com/docs/phoenix/tracing/how-to-tracing",
          description: "How-to",
          section: "Tracing",
        },
        {
          title: "Setup Tracing",
          url: "https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing",
          description: "Setup",
          section: "Tracing",
        },
      ];

      const index = generateSectionIndex("tracing", entries);
      expect(index).toContain("- [How-to Tracing](how-to-tracing.md)");
      expect(index).toContain(
        "- [Setup Tracing](how-to-tracing/setup-tracing.md)"
      );
    });
  });
});
