import { describe, expect, it } from "vitest";

import type { DocEntry } from "../src/commands/docs";
import {
  filterByWorkflows,
  parseLlmsTxt,
  urlToFilePath,
} from "../src/commands/docs";

const SAMPLE_LLMS_TXT = `# Phoenix Documentation

> Phoenix is an open-source observability library.

## Tracing

- [LLM Traces](https://arize.com/docs/phoenix/tracing/llm-traces)
- [Setup Tracing](https://arize.com/docs/phoenix/tracing/setup-tracing)

## Evaluation

- [How to Evals](https://arize.com/docs/phoenix/evaluation/how-to-evals)
- [LLM as Judge](https://arize.com/docs/phoenix/evaluation/llm-as-judge)

## Datasets & Experiments

- [Manage Datasets](https://arize.com/docs/phoenix/datasets/manage-datasets)

## Prompt Engineering

- [Prompt Templates](https://arize.com/docs/phoenix/prompt-engineering/prompt-templates)

## Integrations

- [OpenAI](https://arize.com/docs/phoenix/integrations/openai)

## SDK & API Reference

- [Python SDK](https://arize.com/docs/phoenix/sdk/python-sdk)

## Self-Hosting

- [Docker](https://arize.com/docs/phoenix/self-hosting/docker)

## Cookbooks

- [RAG Cookbook](https://arize.com/docs/phoenix/cookbooks/rag-cookbook)
`;

describe("docs", () => {
  describe("parseLlmsTxt", () => {
    it("should parse sections and entries from llms.txt content", () => {
      const entries = parseLlmsTxt(SAMPLE_LLMS_TXT);

      expect(entries.length).toBe(10);
      expect(entries[0]).toEqual({
        title: "LLM Traces",
        url: "https://arize.com/docs/phoenix/tracing/llm-traces",
        section: "Tracing",
      });
      expect(entries[1]).toEqual({
        title: "Setup Tracing",
        url: "https://arize.com/docs/phoenix/tracing/setup-tracing",
        section: "Tracing",
      });
    });

    it("should assign correct sections to entries", () => {
      const entries = parseLlmsTxt(SAMPLE_LLMS_TXT);
      const sections = entries.map((entry) => entry.section);

      expect(sections).toEqual([
        "Tracing",
        "Tracing",
        "Evaluation",
        "Evaluation",
        "Datasets & Experiments",
        "Prompt Engineering",
        "Integrations",
        "SDK & API Reference",
        "Self-Hosting",
        "Cookbooks",
      ]);
    });

    it("should handle empty content", () => {
      expect(parseLlmsTxt("")).toEqual([]);
    });

    it("should handle content with no links", () => {
      const content = "# Title\n\n## Section\n\nSome text without links.\n";
      expect(parseLlmsTxt(content)).toEqual([]);
    });

    it("should handle links without a preceding section", () => {
      const content =
        "- [Top Level](https://arize.com/docs/phoenix/top-level)\n";
      const entries = parseLlmsTxt(content);
      expect(entries).toEqual([
        {
          title: "Top Level",
          url: "https://arize.com/docs/phoenix/top-level",
          section: "",
        },
      ]);
    });
  });

  describe("filterByWorkflows", () => {
    const entries: DocEntry[] = [
      {
        title: "LLM Traces",
        url: "https://arize.com/docs/phoenix/tracing/llm-traces",
        section: "Tracing",
      },
      {
        title: "How to Evals",
        url: "https://arize.com/docs/phoenix/evaluation/how-to-evals",
        section: "Evaluation",
      },
      {
        title: "Manage Datasets",
        url: "https://arize.com/docs/phoenix/datasets/manage-datasets",
        section: "Datasets & Experiments",
      },
      {
        title: "Docker",
        url: "https://arize.com/docs/phoenix/self-hosting/docker",
        section: "Self-Hosting",
      },
    ];

    it("should return all entries when no workflows specified", () => {
      expect(filterByWorkflows(entries, [])).toEqual(entries);
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

    it("should handle URLs without the Phoenix prefix", () => {
      const result = urlToFilePath("https://other.com/some/path", ".px/docs");
      // path.join normalizes :// to :/ — acceptable since non-Phoenix URLs are an edge case
      expect(result).toBe(".px/docs/https:/other.com/some/path.md");
    });

    it("should strip trailing slashes from the URL path", () => {
      const result = urlToFilePath(
        "https://arize.com/docs/phoenix/tracing/llm-traces/",
        ".px/docs"
      );
      expect(result).toBe(".px/docs/tracing/llm-traces.md");
    });
  });
});
