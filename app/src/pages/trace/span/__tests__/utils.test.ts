import { describe, expect, it } from "vitest";

import type { DocumentEvaluation } from "../types";
import {
  getEmbeddingAttributes,
  getLLMAttributes,
  getRerankerAttributes,
  getRetrieverAttributes,
  getToolAttributes,
  groupDocumentEvaluationsByPosition,
  parseSpanAttributes,
} from "../utils";

describe("parseSpanAttributes", () => {
  it("parses a valid JSON attributes payload", () => {
    const result = parseSpanAttributes('{"llm": {"model_name": "gpt-4"}}');
    expect(result.json).toEqual({ llm: { model_name: "gpt-4" } });
    expect(result.parseError).toBeUndefined();
  });

  it("returns a parse error for invalid JSON", () => {
    const result = parseSpanAttributes("not json");
    expect(result.json).toBeNull();
    expect(result.parseError).toBeInstanceOf(Error);
  });
});

describe("getLLMAttributes", () => {
  it("returns empty defaults when there are no llm attributes", () => {
    expect(getLLMAttributes({})).toEqual({
      modelName: null,
      provider: null,
      inputMessages: [],
      outputMessages: [],
      toolSchemas: [],
      prompts: [],
      promptTemplate: null,
      invocationParameters: "{}",
    });
  });

  it("extracts the llm attribute shapes", () => {
    const result = getLLMAttributes({
      llm: {
        model_name: "gpt-4",
        provider: "openai",
        input_messages: [
          { message: { role: "user", content: "hello" } },
          { message: { role: "assistant", content: "hi" } },
        ],
        output_messages: [{ message: { role: "assistant", content: "hi" } }],
        tools: [{ tool: { json_schema: '{"name": "search"}' } }, { tool: {} }],
        prompts: ["prompt one", "prompt two"],
        prompt_template: {
          template: "Hello {name}",
          variables: { name: "world" },
        },
        invocation_parameters: '{"temperature": 0.5}',
      },
    });
    expect(result).toEqual({
      modelName: "gpt-4",
      provider: "openai",
      inputMessages: [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
      ],
      outputMessages: [{ role: "assistant", content: "hi" }],
      toolSchemas: ['{"name": "search"}'],
      prompts: ["prompt one", "prompt two"],
      promptTemplate: {
        template: "Hello {name}",
        variables: { name: "world" },
      },
      invocationParameters: '{"temperature": 0.5}',
    });
  });

  it("ignores messages that do not conform to the messages shape", () => {
    const result = getLLMAttributes({
      llm: {
        input_messages: "not messages",
        output_messages: ["not a message object"],
      },
    });
    expect(result.inputMessages).toEqual([]);
    expect(result.outputMessages).toEqual([]);
  });

  it("ignores prompts that are not a string array", () => {
    const result = getLLMAttributes({
      llm: {
        // @ts-expect-error intentionally malformed attribute value
        prompts: [{ prompt: "not a string" }],
      },
    });
    expect(result.prompts).toEqual([]);
  });
});

describe("getRetrieverAttributes", () => {
  it("returns an empty list when there are no retrieval attributes", () => {
    expect(getRetrieverAttributes({})).toEqual({ documents: [] });
  });

  it("extracts the documents, dropping empty entries", () => {
    const result = getRetrieverAttributes({
      retrieval: {
        documents: [
          { document: { id: "1", content: "doc one" } },
          {},
          { document: { id: "2", content: "doc two" } },
        ],
      },
    });
    expect(result.documents).toEqual([
      { id: "1", content: "doc one" },
      { id: "2", content: "doc two" },
    ]);
  });
});

describe("getRerankerAttributes", () => {
  it("returns empty defaults when there are no reranker attributes", () => {
    expect(getRerankerAttributes({})).toEqual({
      query: null,
      inputDocuments: [],
      outputDocuments: [],
    });
  });

  it("extracts the query and document lists", () => {
    const result = getRerankerAttributes({
      reranker: {
        query: "what is phoenix",
        input_documents: [{ document: { id: "1" } }],
        output_documents: [{ document: { id: "2" } }],
      },
    });
    expect(result).toEqual({
      query: "what is phoenix",
      inputDocuments: [{ id: "1" }],
      outputDocuments: [{ id: "2" }],
    });
  });
});

describe("getEmbeddingAttributes", () => {
  it("returns empty defaults when there are no embedding attributes", () => {
    expect(getEmbeddingAttributes({})).toEqual({
      modelName: null,
      embeddings: [],
    });
  });

  it("extracts the model name and embedded texts", () => {
    const result = getEmbeddingAttributes({
      embedding: {
        model_name: "text-embedding-3-small",
        embeddings: [{ embedding: { text: "embedded text" } }],
      },
    });
    expect(result).toEqual({
      modelName: "text-embedding-3-small",
      embeddings: [{ text: "embedded text" }],
    });
  });
});

describe("getToolAttributes", () => {
  it("reports when there are no tool attributes", () => {
    expect(getToolAttributes({})).toEqual({
      hasToolAttributes: false,
      name: undefined,
      description: undefined,
      parameters: undefined,
    });
  });

  it("extracts the tool description", () => {
    expect(
      getToolAttributes({
        tool: {
          name: "search",
          description: "Searches the web",
          parameters: '{"type": "object"}',
        },
      })
    ).toEqual({
      hasToolAttributes: true,
      name: "search",
      description: "Searches the web",
      parameters: '{"type": "object"}',
    });
  });
});

describe("groupDocumentEvaluationsByPosition", () => {
  const makeEvaluation = (
    documentPosition: number,
    name: string
  ): DocumentEvaluation => ({
    id: `${name}-${documentPosition}`,
    annotatorKind: "LLM",
    documentPosition,
    name,
    label: null,
    score: null,
    explanation: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    user: null,
  });

  it("groups evaluations by document position", () => {
    const relevanceAtZero = makeEvaluation(0, "relevance");
    const correctnessAtZero = makeEvaluation(0, "correctness");
    const relevanceAtTwo = makeEvaluation(2, "relevance");
    expect(
      groupDocumentEvaluationsByPosition([
        relevanceAtZero,
        correctnessAtZero,
        relevanceAtTwo,
      ])
    ).toEqual({
      0: [relevanceAtZero, correctnessAtZero],
      2: [relevanceAtTwo],
    });
  });

  it("returns an empty map for no evaluations", () => {
    expect(groupDocumentEvaluationsByPosition([])).toEqual({});
  });
});
