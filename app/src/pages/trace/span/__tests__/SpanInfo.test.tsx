import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { SpanInfoCardsProvider } from "../../SpanInfoCardsContext";
import { getExpectedSpanInfoSectionKeys, SpanInfo } from "../SpanInfo";

const sectionIds = {
  input: "input",
  output: "output",
  toolDefinitions: "tool-definitions",
  metadata: "metadata",
};

function TestProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider themeMode="dark" disableBodyTheme>
      <PreferencesProvider>
        <SpanInfoCardsProvider>{children}</SpanInfoCardsProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}

const malformedAttributes = JSON.stringify({
  llm: {
    model_name: { value: "model" },
    input_messages: [
      {
        message: {
          role: { value: "assistant" },
          content: { type: "text", text: "hello" },
          name: { value: "name" },
          function_call_name: { value: "search" },
          function_call_arguments_json: { query: "phoenix" },
          tool_call_id: { value: "call-1" },
          contents: [
            {
              message_content: {
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
  retrieval: {
    documents: [
      {
        document: {
          id: { value: "1" },
          content: { text: "document" },
          score: { value: 0.95 },
          metadata: { source: "test" },
        },
      },
    ],
  },
  reranker: {
    query: { text: "what is phoenix" },
    input_documents: [
      { document: { id: { value: "1" }, content: { text: "input" } } },
    ],
    output_documents: [
      { document: { id: { value: "2" }, content: { text: "output" } } },
    ],
  },
  embedding: {
    embeddings: [{ embedding: { text: { value: "embedded" } } }],
  },
  tool: {
    name: { value: "search" },
    description: { value: "Searches" },
    parameters: { type: "object" },
  },
  metadata: { nested: { value: "metadata" } },
});

describe("SpanInfo", () => {
  installTestMatchMedia();

  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each([
    ["llm", ["input", "output", "toolDefinitions", "metadata"]],
    ["tool", ["input", "output", "toolDefinitions", "metadata"]],
    ["embedding", ["input", "metadata"]],
    ["retriever", ["input", "output", "metadata"]],
    ["chain", ["input", "output", "metadata"]],
  ] as const)(
    "defines the expected content for %s spans",
    (spanKind, expectedKeys) => {
      expect(getExpectedSpanInfoSectionKeys(spanKind)).toEqual(expectedKeys);
    }
  );

  it.each(["llm", "reranker"])(
    "does not render empty %s input or output sections",
    (spanKind) => {
      act(() => {
        root.render(
          <TestProviders>
            <SpanInfo
              sectionIds={sectionIds}
              span={{
                id: "span-node-id",
                spanKind,
                attributes: "{}",
                input: null,
                output: null,
                documentRetrievalMetrics: [],
                documentEvaluations: [],
              }}
            />
          </TestProviders>
        );
      });

      expect(container.querySelector("#input")).toBeNull();
      expect(container.querySelector("#output")).toBeNull();
    }
  );

  it.each(["llm", "retriever", "reranker", "embedding", "tool", "unknown"])(
    "never passes object-valued %s attributes to React as children",
    (spanKind) => {
      expect(() => {
        act(() => {
          root.render(
            <TestProviders>
              <SpanInfo
                sectionIds={sectionIds}
                span={{
                  id: "span-node-id",
                  spanKind,
                  attributes: malformedAttributes,
                  input: null,
                  output: null,
                  documentRetrievalMetrics: [],
                  documentEvaluations: [],
                }}
              />
            </TestProviders>
          );
        });
      }).not.toThrow();
      expect(container.textContent).not.toContain(
        "Objects are not valid as a React child"
      );
    }
  );

  it("renders LLM tool definitions as one top-level section", () => {
    act(() => {
      root.render(
        <TestProviders>
          <SpanInfo
            sectionIds={sectionIds}
            span={{
              id: "span-node-id",
              spanKind: "llm",
              attributes: JSON.stringify({
                llm: {
                  tools: [
                    { tool: { json_schema: JSON.stringify({ name: "one" }) } },
                    { tool: { json_schema: JSON.stringify({ name: "two" }) } },
                  ],
                },
              }),
              input: { value: "input", mimeType: "text" },
              output: { value: "output", mimeType: "text" },
              documentRetrievalMetrics: [],
              documentEvaluations: [],
            }}
          />
        </TestProviders>
      );
    });

    expect(container.querySelectorAll("[data-span-info-section]")).toHaveLength(
      3
    );
    expect(
      container.querySelector("#tool-definitions")?.getAttribute("aria-label")
    ).toBe("Tool Definitions");
    expect(container.querySelectorAll("#tool-definitions .card")).toHaveLength(
      2
    );
    expect(
      container.querySelectorAll(
        "#tool-definitions .card > .card__body > .expandable-content"
      )
    ).toHaveLength(2);
  });

  it.each([
    ["llm", "#tool-definitions .card"],
    ["embedding", "#input .card"],
    ["retriever", "#output .card"],
  ] as const)(
    "uses neutral nested card surfaces for %s spans",
    (spanKind, cardSelector) => {
      act(() => {
        root.render(
          <TestProviders>
            <SpanInfo
              sectionIds={sectionIds}
              span={{
                id: "span-node-id",
                spanKind,
                attributes: malformedAttributes,
                input: null,
                output: null,
                documentRetrievalMetrics: [],
                documentEvaluations: [],
              }}
            />
          </TestProviders>
        );
      });

      const card = container.querySelector<HTMLElement>(cardSelector);
      expect(card).not.toBeNull();
      expect(card?.style.backgroundColor).toBe("");
      expect(card?.style.borderColor).toBe("");
    }
  );

  it("renders a document score as an annotation label", () => {
    act(() => {
      root.render(
        <TestProviders>
          <SpanInfo
            sectionIds={sectionIds}
            span={{
              id: "span-node-id",
              spanKind: "retriever",
              attributes: JSON.stringify({
                retrieval: {
                  documents: [
                    {
                      document: {
                        id: "1",
                        content: "document",
                        score: 0.95,
                      },
                    },
                  ],
                },
              }),
              input: null,
              output: null,
              documentRetrievalMetrics: [],
              documentEvaluations: [],
            }}
          />
        </TestProviders>
      );
    });

    const scoreLabel = container.querySelector(
      '#output .card [aria-label="Annotation: score"]'
    );
    expect(scoreLabel?.textContent).toBe("score0.95");
  });

  it("bounds generic input, output, and metadata leaf content", () => {
    act(() => {
      root.render(
        <TestProviders>
          <SpanInfo
            sectionIds={sectionIds}
            span={{
              id: "span-node-id",
              spanKind: "chain",
              attributes: JSON.stringify({ metadata: { source: "test" } }),
              input: { value: "input", mimeType: "text" },
              output: { value: "output", mimeType: "text" },
              documentRetrievalMetrics: [],
              documentEvaluations: [],
            }}
          />
        </TestProviders>
      );
    });

    expect(
      container.querySelector(
        "#input .span-details-input-section__surface > .expandable-content"
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        "#output > [aria-labelledby] > .expandable-content"
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        "#metadata > [aria-labelledby] > .expandable-content"
      )
    ).not.toBeNull();
  });

  it("shows bounded LLM context alongside the selected raw view", () => {
    act(() => {
      root.render(
        <TestProviders>
          <SpanInfo
            sectionIds={sectionIds}
            span={{
              id: "span-node-id",
              spanKind: "llm",
              attributes: JSON.stringify({
                llm: {
                  invocation_parameters: JSON.stringify({
                    temperature: 0.2,
                  }),
                },
              }),
              input: { value: "input", mimeType: "text" },
              output: null,
              documentRetrievalMetrics: [],
              documentEvaluations: [],
            }}
          />
        </TestProviders>
      );
    });

    expect(container.querySelector("#input .card")?.textContent).toContain(
      "Invocation Params"
    );
    expect(
      container.querySelector(
        "#input .card > .card__body > .expandable-content"
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        "#input .span-details-input-section__surface > .expandable-content"
      )
    ).not.toBeNull();
  });

  it("does not wrap LLM message cards in the prompt surface", () => {
    act(() => {
      root.render(
        <TestProviders>
          <SpanInfo
            sectionIds={sectionIds}
            span={{
              id: "span-node-id",
              spanKind: "llm",
              attributes: malformedAttributes,
              input: { value: "input", mimeType: "text" },
              output: null,
              documentRetrievalMetrics: [],
              documentEvaluations: [],
            }}
          />
        </TestProviders>
      );
    });

    expect(
      container.querySelector("#input .span-details-input-section__surface")
    ).toBeNull();
    expect(container.querySelector("#input .card")).not.toBeNull();
    expect(
      container.querySelector("#input .disclosure__panel > .expandable-content")
    ).not.toBeNull();
  });

  it("wraps a reranker query without wrapping its document cards", () => {
    act(() => {
      root.render(
        <TestProviders>
          <SpanInfo
            sectionIds={sectionIds}
            span={{
              id: "span-node-id",
              spanKind: "reranker",
              attributes: malformedAttributes,
              input: null,
              output: null,
              documentRetrievalMetrics: [],
              documentEvaluations: [],
            }}
          />
        </TestProviders>
      );
    });

    expect(
      container.querySelectorAll("#input .span-details-input-section__surface")
    ).toHaveLength(1);
    expect(
      container.querySelector(
        "#input .span-details-input-section__surface .card"
      )
    ).toBeNull();
    expect(container.querySelector("#input .card")).not.toBeNull();
  });
});
