import { describe, expect, it } from "vitest";

import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import type { DocumentEvaluation } from "../types";
import {
  countToolCalls,
  describeMessage,
  getEmbeddingAttributes,
  getLLMAttributes,
  getMessagePreview,
  getMessageSearchTexts,
  getPromptTemplatePreview,
  getRerankerAttributes,
  getRetrieverAttributes,
  getToolAttributes,
  groupDocumentEvaluationsByPosition,
  messageMatchesQuery,
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

  it("stringifies a json_schema that ingestion rebuilt as an object", () => {
    const result = getLLMAttributes({
      llm: {
        tools: [
          {
            tool: {
              // An instrumentation that flattens `tool.json_schema.*` makes
              // ingestion store json_schema as a nested object instead of a
              // JSON string. json_schema is typed unknown, so this shape is
              // supplied directly rather than asserted into a string.
              json_schema: {
                name: "search",
                parameters: { type: "object" },
              },
            },
          },
        ],
      },
    });
    expect(result.toolSchemas).toEqual([
      '{"name":"search","parameters":{"type":"object"}}',
    ]);
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

describe("getMessagePreview", () => {
  it("prefers the multi-modal contents, which the card renders first", () => {
    expect(
      getMessagePreview({
        role: "user",
        content: "the plain content",
        contents: [
          { message_content: { type: "text", text: "what is in this image?" } },
          {
            message_content: { type: "image", image: { image: { url: "u" } } },
          },
        ],
      })
    ).toBe("what is in this image?");
  });

  it("falls back to the content, then to the tool calls", () => {
    expect(getMessagePreview({ role: "user", content: "just content" })).toBe(
      "just content"
    );
    expect(
      getMessagePreview({
        role: "assistant",
        tool_calls: [
          {
            tool_call: {
              function: { name: "get_weather", arguments: '{"city":"SF"}' },
            },
          },
        ],
      })
    ).toBe('get_weather({"city":"SF"})');
  });

  // this runs in the card's own render, above the boundary that guards the
  // rendered contents, so a malformed span must not take the pane down
  it("survives contents that did not arrive as an array", () => {
    expect(() =>
      getMessagePreview({
        role: "user",
        contents: "not an array" as never,
        content: "the content",
      })
    ).not.toThrow();
    expect(
      getMessagePreview({
        role: "user",
        contents: "not an array" as never,
        content: "the content",
      })
    ).toBe("the content");
  });

  // a structured value here would otherwise stringify as [object Object]
  it("ignores content text that is not a string", () => {
    expect(
      getMessagePreview({
        role: "user",
        contents: [{ message_content: { text: { nested: "value" } as never } }],
        content: "the content",
      })
    ).toBe("the content");
  });

  // the card renders the deprecated function call only when it has both parts,
  // so previewing on the name alone would advertise an empty card body
  it("previews the deprecated function call only with its arguments", () => {
    expect(
      getMessagePreview({
        role: "assistant",
        function_call_name: "get_weather",
      })
    ).toBeUndefined();
    expect(
      getMessagePreview({
        role: "assistant",
        function_call_name: "get_weather",
        function_call_arguments_json: '{"city":"SF"}',
      })
    ).toBe('get_weather({"city":"SF"})');
  });

  it("returns undefined for a message with nothing to show", () => {
    expect(getMessagePreview({ role: "assistant" })).toBeUndefined();
    expect(
      getMessagePreview({ role: "assistant", content: "" })
    ).toBeUndefined();
  });
});

describe("describeMessage", () => {
  it("names a message by its role and preview", () => {
    expect(describeMessage({ role: "assistant", content: "Paris" })).toBe(
      "assistant: Paris"
    );
  });

  // an image-only turn previews as nothing at all, and "user: " reads worse
  // than "user"
  it("falls back to the role alone when there is no preview", () => {
    expect(describeMessage({ role: "user" })).toBe("user");
  });

  it("falls back to the preview alone when there is no role", () => {
    expect(describeMessage({ content: "Paris" })).toBe("Paris");
  });
});

describe("getMessageSearchTexts", () => {
  it("returns the message content", () => {
    expect(
      getMessageSearchTexts({ role: "user", content: "the connection pool" })
    ).toEqual(["the connection pool"]);
  });

  it("returns the text of each multi-modal content part", () => {
    expect(
      getMessageSearchTexts({
        role: "user",
        contents: [
          { message_content: { type: "text", text: "first part" } },
          { message_content: { type: "text", text: "second part" } },
        ],
      })
    ).toEqual(["first part", "second part"]);
  });

  it("returns tool call names but not their arguments", () => {
    const texts = getMessageSearchTexts({
      role: "assistant",
      content: "checking the logs",
      tool_calls: [
        {
          tool_call: {
            function: {
              name: "search_logs",
              arguments: '{"service":"checkout-api"}',
            },
          },
        },
      ],
    });
    expect(texts).toContain("search_logs");
    expect(texts).toContain("checking the logs");
    expect(texts.join(" ")).not.toContain("checkout-api");
  });

  it("returns the deprecated function call name", () => {
    expect(
      getMessageSearchTexts({
        role: "assistant",
        function_call_name: "get_metrics",
        function_call_arguments_json: '{"service":"checkout-api"}',
      })
    ).toEqual(["get_metrics"]);
  });

  // A tool result is a message whose content is the result, so it needs no
  // handling of its own
  it("returns a tool result's content", () => {
    expect(
      getMessageSearchTexts({
        role: "tool",
        tool_call_id: "call_001",
        content: '{"error_rate": 0.42}',
      })
    ).toEqual(['{"error_rate": 0.42}']);
  });

  // Regression guard. `String(value)` on an object yields "[object Object]",
  // so content emitted as an object would silently match nothing and a reader
  // would conclude the span does not hold what they searched for.
  it("stringifies object content as JSON rather than [object Object]", () => {
    const texts = getMessageSearchTexts({
      role: "user",
      content: { role: "user", text: "hello world" },
    } as never);
    expect(texts.join(" ")).not.toContain("[object Object]");
    expect(texts.join(" ")).toContain("hello world");
  });

  it("skips empty and missing pieces rather than returning blanks", () => {
    expect(getMessageSearchTexts({ role: "user", content: "" })).toEqual([]);
    expect(getMessageSearchTexts({ role: "user" })).toEqual([]);
  });

  it("survives contents that are not an array", () => {
    expect(
      getMessageSearchTexts({ role: "user", contents: "not an array" } as never)
    ).toEqual([]);
  });
});

describe("messageMatchesQuery", () => {
  const message: AttributeMessage = {
    role: "assistant",
    content: "the database connection pool is saturated",
    tool_calls: [
      {
        tool_call: {
          function: { name: "get_metrics", arguments: '{"window":"09:30Z"}' },
        },
      },
    ],
  };

  it("matches a partial word", () => {
    expect(messageMatchesQuery(message, "pool")).toBe(true);
    expect(messageMatchesQuery(message, "satur")).toBe(true);
  });

  it("matches regardless of case", () => {
    expect(messageMatchesQuery(message, "database")).toBe(true);
  });

  it("matches a tool call name", () => {
    expect(messageMatchesQuery(message, "get_metrics")).toBe(true);
  });

  it("does not match tool call arguments", () => {
    expect(messageMatchesQuery(message, "09:30z")).toBe(false);
  });

  it("does not match the role", () => {
    expect(messageMatchesQuery(message, "assistant")).toBe(false);
  });

  it("treats an empty query as matching nothing", () => {
    expect(messageMatchesQuery(message, "")).toBe(false);
  });

  // The exclusions the PR states, asserted rather than claimed. Matching is
  // substring only: it never corrects a typo and never normalises punctuation.
  it("does not correct a misspelling", () => {
    const typo: AttributeMessage = {
      role: "user",
      content: "the databse is slow",
    };
    expect(messageMatchesQuery(typo, "database")).toBe(false);
    expect(messageMatchesQuery(typo, "databse")).toBe(true);
  });

  it("does not normalise punctuation or spacing", () => {
    const hyphenated: AttributeMessage = {
      role: "user",
      content: "the request timed out after a time-out",
    };
    expect(messageMatchesQuery(hyphenated, "timeout")).toBe(false);
    expect(messageMatchesQuery(hyphenated, "time-out")).toBe(true);
  });

  // Each piece is searched on its own, so a query cannot match by spanning the
  // gap between a message's content and the name of a tool it called
  it("does not match across the seam between two pieces", () => {
    expect(messageMatchesQuery(message, "saturated get_metrics")).toBe(false);
  });
});

describe("getPromptTemplatePreview", () => {
  it("prefers the template, which the card opens on", () => {
    expect(
      getPromptTemplatePreview({
        template: "Answer {{question}} in a {{tone}} tone",
        variables: { question: "why?", tone: "friendly" },
      })
    ).toBe("Answer {{question}} in a {{tone}} tone");
  });

  it("falls back to the variables it interpolates", () => {
    expect(
      getPromptTemplatePreview({
        template: undefined as never,
        variables: { question: "why?", tone: "friendly" },
      })
    ).toBe("question: why?, tone: friendly");
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

  it("stringifies parameters that ingestion rebuilt as an object", () => {
    // An instrumentation that emits flattened `tool.parameters.*` keys makes
    // ingestion store `parameters` as a nested object instead of a JSON string.
    expect(
      getToolAttributes({
        tool: {
          name: "search_phoenix",
          description: "Search the docs",
          parameters: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
          } as unknown as string,
        },
      })
    ).toEqual({
      hasToolAttributes: true,
      name: "search_phoenix",
      description: "Search the docs",
      parameters:
        '{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}',
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
