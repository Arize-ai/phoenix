import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@phoenix/components/markdown", () => ({
  ConnectedMarkdownBlock: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  ConnectedMarkdownModeSelect: () => <button>markdown mode</button>,
  MarkdownDisplayProvider: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));

// CodeMirror measures the DOM, which jsdom cannot do; the cards under test only
// care that their body rendered something
vi.mock("../../ReadonlyJSONBlock", () => ({
  PreBlock: ({ children }: { children?: ReactNode }) => <pre>{children}</pre>,
  ReadonlyJSONBlock: ({ children }: { children?: ReactNode }) => (
    <pre>{children}</pre>
  ),
}));

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { DocumentItem } from "../../DocumentItem";
import { SpanInfoCardsProvider } from "../../SpanInfoCardsContext";
import { EmbeddingInput } from "../EmbeddingInput";
import { LLMInput } from "../LLMInput";
import { LLMInvocationParams } from "../LLMInvocationParams";
import { LLMMessage } from "../LLMMessage";
import { LLMOutput } from "../LLMOutput";
import { LLMPromptsList } from "../LLMPromptsList";
import { LLMToolSchemasList } from "../LLMToolSchemasList";
import { RerankerInput } from "../RerankerInput";
import { RerankerOutput } from "../RerankerOutput";
import { RetrieverInput } from "../RetrieverInput";
import { RetrieverOutput } from "../RetrieverOutput";
import { SpanInput } from "../SpanInput";
import { SpanMetadata } from "../SpanMetadata";
import { SpanOutput } from "../SpanOutput";
import { ToolMetadata } from "../ToolMetadata";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // jsdom does not implement matchMedia, which the theme provider reads to
  // resolve the system theme
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

function render(element: ReactNode) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <SpanInfoCardsProvider>{element}</SpanInfoCardsProvider>
      </ThemeProvider>
    );
  });
}

const emptyLLMProps = {
  modelName: null,
  provider: null,
  input: null,
  inputMessages: [],
  toolSchemas: [],
  promptTemplate: null,
  prompts: [],
  invocationParameters: "{}",
};

/**
 * Every card in the span details view — one entry per card, so a card added
 * without a copy button in its header fails here rather than in review.
 */
const cards: { name: string; element: ReactNode }[] = [
  {
    name: "SpanInput (text)",
    element: <SpanInput value="hello" mimeType="text" />,
  },
  {
    name: "SpanInput (json)",
    element: <SpanInput value='{"a":1}' mimeType="json" />,
  },
  {
    name: "SpanOutput (text)",
    element: <SpanOutput value="hello" mimeType="text" />,
  },
  {
    name: "RetrieverInput (text)",
    element: <RetrieverInput value="what is phoenix?" mimeType="text" />,
  },
  {
    name: "RetrieverInput (json)",
    element: <RetrieverInput value='{"query":"hi"}' mimeType="json" />,
  },
  {
    name: "RetrieverOutput",
    element: (
      <RetrieverOutput
        documents={[{ content: "a document" }]}
        documentEvaluationsByPosition={{}}
        retrievalMetrics={[]}
        spanNodeId="U3Bhbjox"
      />
    ),
  },
  {
    name: "RerankerInput",
    element: (
      <RerankerInput
        query="what is phoenix?"
        inputDocuments={[{ content: "a document" }]}
      />
    ),
  },
  {
    name: "RerankerOutput",
    element: <RerankerOutput outputDocuments={[{ content: "a document" }]} />,
  },
  {
    name: "EmbeddingInput",
    element: <EmbeddingInput embeddings={[{ text: "embedded text" }]} />,
  },
  {
    name: "SpanMetadata",
    element: <SpanMetadata metadata={{ user: "abc123" }} />,
  },
  {
    name: "ToolMetadata",
    element: (
      <ToolMetadata
        name="search"
        description="Searches the web"
        parameters='{"type":"object"}'
      />
    ),
  },
  {
    name: "LLMInvocationParams",
    element: <LLMInvocationParams invocationParameters='{"temperature":0.5}' />,
  },
  {
    name: "LLMMessage",
    element: <LLMMessage message={{ role: "user", content: "hi" }} />,
  },
  {
    name: "DocumentItem",
    element: <DocumentItem document={{ content: "a document" }} />,
  },
  {
    name: "LLMInput (messages view)",
    element: (
      <LLMInput
        {...emptyLLMProps}
        inputMessages={[{ role: "user", content: "hi" }]}
      />
    ),
  },
  {
    name: "LLMInput (tools view)",
    element: (
      <LLMInput {...emptyLLMProps} toolSchemas={['{"name":"search"}']} />
    ),
  },
  {
    name: "LLMInput (raw view)",
    element: (
      <LLMInput
        {...emptyLLMProps}
        input={{ value: '{"messages":[]}', mimeType: "json" }}
      />
    ),
  },
  {
    name: "LLMInput (prompts view)",
    element: <LLMInput {...emptyLLMProps} prompts={["a raw prompt"]} />,
  },
  {
    name: "LLMOutput (messages view)",
    element: (
      <LLMOutput
        output={null}
        outputMessages={[{ role: "assistant", content: "hi" }]}
      />
    ),
  },
  {
    name: "LLMOutput (raw view)",
    element: (
      <LLMOutput
        output={{ value: "hello", mimeType: "text" }}
        outputMessages={[]}
      />
    ),
  },
];

describe("span details card copy buttons", () => {
  it.each(cards)(
    "$name puts a copy button last in its card header",
    ({ element }) => {
      render(element);
      const header = container.querySelector("section.card > header");
      expect(header).not.toBeNull();
      const copyButtons = header?.querySelectorAll(".copy-to-clipboard-button");
      expect(copyButtons?.length).toBe(1);
      // the copy button is the last control in the header, so it lands in the
      // same place whatever else the header holds
      expect(copyButtons?.[0].nextElementSibling).toBeNull();
    }
  );
});

describe("cards nested in the span details view", () => {
  it("puts a copy button last in each raw prompt's header", () => {
    render(<LLMPromptsList prompts={["first prompt", "second prompt"]} />);
    const headers = container.querySelectorAll("section.card > header");
    expect(headers.length).toBe(2);
    headers.forEach((header) => {
      const copyButton = header.querySelector(".copy-to-clipboard-button");
      expect(copyButton).not.toBeNull();
      expect(copyButton?.nextElementSibling).toBeNull();
    });
  });

  it("puts a copy button last in each tool schema's header", () => {
    render(<LLMToolSchemasList toolSchemas={['{"name":"search"}']} />);
    const header = container.querySelector("section.card > header");
    const copyButton = header?.querySelector(".copy-to-clipboard-button");
    expect(copyButton).not.toBeNull();
    expect(copyButton?.nextElementSibling).toBeNull();
  });

  it("shows a tool's parameter schema as the JSON it is, matching the copy", () => {
    render(
      <ToolMetadata
        name="search"
        description="Searches the web"
        parameters='{"type":"object"}'
      />
    );
    // the schema arrives as JSON text; encoding it again would render one
    // escaped line rather than the schema
    const block = container.querySelector("pre");
    expect(block?.textContent).toBe('{"type":"object"}');
  });

  it("puts a copy button last in each embedded text's header", () => {
    render(
      <EmbeddingInput
        embeddings={[{ text: "first text" }, { text: "second text" }]}
      />
    );
    // the input card and one card per embedded text
    const headers = container.querySelectorAll("section.card > header");
    expect(headers.length).toBe(3);
    headers.forEach((header) => {
      const copyButton = header.querySelector(".copy-to-clipboard-button");
      expect(copyButton).not.toBeNull();
      expect(copyButton?.nextElementSibling).toBeNull();
    });
  });
});
