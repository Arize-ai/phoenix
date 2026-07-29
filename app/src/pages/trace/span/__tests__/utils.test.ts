import { describe, expect, it } from "vitest";

import type { DocumentEvaluation } from "../types";
import {
  countToolCalls,
  getEmbeddingAttributes,
  getLLMAttributes,
  getRerankerAttributes,
  getRetrieverAttributes,
  getToolAttributes,
  getToolCalls,
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

  it.each(["[]", '"attributes"', "42", "null"])(
    "rejects a non-object attributes payload: %s",
    (attributes) => {
      const result = parseSpanAttributes(attributes);
      expect(result.json).toBeNull();
      expect(result.parseError).toBeInstanceOf(Error);
    }
  );
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
        prompts: [{ prompt: "not a string" }],
      },
    });
    expect(result.prompts).toEqual([]);
  });

  it("normalizes every untrusted display leaf before returning it", () => {
    const result = getLLMAttributes({
      llm: {
        model_name: { family: "gpt" },
        provider: ["openai"],
        input_messages: [
          {
            message: {
              role: { name: "assistant" },
              content: { type: "text", text: "hello" },
              name: { value: "bot" },
              function_call_name: { value: "search" },
              function_call_arguments_json: { query: "phoenix" },
              tool_call_id: { value: "call-1" },
              contents: [
                {
                  message_content: {
                    type: { value: "text" },
                    text: { value: "hello" },
                    image: { image: { url: { value: "image.png" } } },
                  },
                },
              ],
              tool_calls: [
                {
                  tool_call: {
                    id: { value: "call-1" },
                    function: {
                      name: { value: "search" },
                      arguments: { query: "phoenix" },
                    },
                  },
                },
              ],
            },
          },
        ],
        tools: [{ tool: { json_schema: { type: "object" } } }],
        prompt_template: {
          template: { value: "Hello" },
          variables: { name: { value: "Phoenix" } },
        },
        invocation_parameters: { temperature: 0.5 },
      },
    });

    expect(result.modelName).toBe('{\n  "family": "gpt"\n}');
    expect(result.provider).toBe('[\n  "openai"\n]');
    expect(result.toolSchemas).toEqual(['{\n  "type": "object"\n}']);
    expect(result.promptTemplate?.template).toBe('{\n  "value": "Hello"\n}');
    expect(result.invocationParameters).toBe('{\n  "temperature": 0.5\n}');

    const message = result.inputMessages[0];
    expect(message).toBeDefined();
    expect(
      Object.values(message ?? {})
        .filter(Boolean)
        .every((value) => typeof value === "string" || Array.isArray(value))
    ).toBe(true);
    expect(getToolCalls(message ?? {})).toEqual([
      {
        id: '{\n  "value": "call-1"\n}',
        function: {
          name: '{\n  "value": "search"\n}',
          arguments: '{\n  "query": "phoenix"\n}',
        },
      },
    ]);
  });
});

describe("countToolCalls", () => {
  it("sums the tool calls across messages, skipping empty entries", () => {
    expect(
      countToolCalls([
        { role: "assistant", content: "no tool calls here" },
        {
          role: "assistant",
          tool_calls: [
            { tool_call: { id: "1", function: { name: "search" } } },
            {},
            { tool_call: { id: "2", function: { name: "calculate" } } },
          ],
        },
        {
          role: "assistant",
          tool_calls: [
            { tool_call: { id: "3", function: { name: "search" } } },
          ],
        },
      ])
    ).toBe(3);
  });

  it("returns zero when there are no messages", () => {
    expect(countToolCalls([])).toBe(0);
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

  it("normalizes object-valued document fields to strings", () => {
    const result = getRetrieverAttributes({
      retrieval: {
        documents: [
          {
            document: {
              id: { value: "1" },
              content: { text: "document" },
              metadata: { source: "test" },
            },
          },
        ],
      },
    });
    expect(result.documents).toEqual([
      {
        id: '{\n  "value": "1"\n}',
        content: '{\n  "text": "document"\n}',
        metadata: '{\n  "source": "test"\n}',
      },
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

  it("normalizes an object-valued query", () => {
    expect(
      getRerankerAttributes({
        reranker: { query: { text: "what is phoenix" } },
      }).query
    ).toBe('{\n  "text": "what is phoenix"\n}');
  });
});

describe("getEmbeddingAttributes", () => {
  it("returns empty defaults when there are no embedding attributes", () => {
    expect(getEmbeddingAttributes({})).toEqual({
      embeddings: [],
    });
  });

  it("extracts the embedded texts", () => {
    const result = getEmbeddingAttributes({
      embedding: {
        model_name: "text-embedding-3-small",
        embeddings: [{ embedding: { text: "embedded text" } }],
      },
    });
    expect(result).toEqual({
      embeddings: [{ text: "embedded text" }],
    });
  });

  it("normalizes an object-valued embedded text", () => {
    expect(
      getEmbeddingAttributes({
        embedding: {
          embeddings: [{ embedding: { text: { value: "embedded" } } }],
        },
      })
    ).toEqual({
      embeddings: [{ text: '{\n  "value": "embedded"\n}' }],
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

  it("normalizes object-valued tool fields", () => {
    expect(
      getToolAttributes({
        tool: {
          name: { value: "search" },
          description: { value: "Searches" },
          parameters: { type: "object" },
        },
      })
    ).toEqual({
      hasToolAttributes: true,
      name: '{\n  "value": "search"\n}',
      description: '{\n  "value": "Searches"\n}',
      parameters: '{\n  "type": "object"\n}',
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
