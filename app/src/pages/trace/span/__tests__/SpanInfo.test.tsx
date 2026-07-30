import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { SpanInfoCardsProvider } from "../../SpanInfoCardsContext";
import { SpanInfo } from "../SpanInfo";

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
  });
});
