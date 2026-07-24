import type { Completion, CompletionContext } from "@codemirror/autocomplete";
import type { EditorView } from "@uiw/react-codemirror";
import { describe, expect, it } from "vitest";

import {
  createOpenInferenceAttributeCompletions,
  createOpenInferenceAttributeValueCompletionSource,
  getOpenInferenceAttributeValueCompletionContext,
  normalizeOpenInferenceAttributeAccessor,
  semanticConventionPathToAttributeAccessor,
} from "../spanFilterSemanticConventionCompletions";

function createCompletionContext(text: string): CompletionContext {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test mock of a complex codemirror type; only the used subset is implemented
  return {
    pos: text.length,
    state: {
      doc: {
        sliceString: (from: number, to?: number) => text.slice(from, to),
      },
    },
  } as unknown as CompletionContext;
}

function createCompletionContextAt({
  text,
  pos = text.length,
}: {
  text: string;
  pos?: number;
}): CompletionContext {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test mock of a complex codemirror type; only the used subset is implemented
  return {
    pos,
    state: {
      doc: {
        sliceString: (from: number, to?: number) => text.slice(from, to),
      },
    },
  } as unknown as CompletionContext;
}

function applyCompletion({
  text,
  completion,
  from,
  to,
}: {
  text: string;
  completion: Completion;
  from: number;
  to: number;
}): string {
  let result = text;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- partial test mock of a complex codemirror type; only the used subset is implemented
  const view = {
    state: {
      doc: {
        length: text.length,
        sliceString: (fromIndex: number, toIndex?: number) =>
          text.slice(fromIndex, toIndex),
      },
    },
    dispatch: ({
      changes,
    }: {
      changes: { from: number; to: number; insert: string };
    }) => {
      result =
        result.slice(0, changes.from) +
        changes.insert +
        result.slice(changes.to);
    },
  } as unknown as EditorView;

  if (typeof completion.apply !== "function") {
    throw new Error("Expected completion apply function");
  }
  completion.apply(view, completion, from, to);
  return result;
}

describe("spanFilterSemanticConventionCompletions", () => {
  it("converts semantic convention paths into nested attribute accessors", () => {
    expect(semanticConventionPathToAttributeAccessor("llm.provider")).toBe(
      "attributes['llm']['provider']"
    );
    expect(
      semanticConventionPathToAttributeAccessor("openinference.span.kind")
    ).toBe("attributes['openinference']['span']['kind']");
  });

  it("generates OpenInference attribute completions from semantic conventions", () => {
    const completions = createOpenInferenceAttributeCompletions({
      semanticConventions: {
        LLM_PROVIDER: "llm.provider",
        MESSAGE_ROLE: "message.role",
        OPENINFERENCE_SPAN_KIND: "openinference.span.kind",
      },
    });

    expect(completions.map((completion) => completion.label)).toEqual([
      "attributes['llm']['provider']",
    ]);
    expect(completions[0].detail).toBe("llm.provider");
  });

  it("generates indexed completions for nested OpenInference list members", () => {
    const labels = createOpenInferenceAttributeCompletions().map(
      (completion) => completion.label
    );

    expect(labels).toContain("attributes['llm']['provider']");
    expect(labels).toContain(
      "attributes['llm']['input_messages'][0]['message']['role']"
    );
    expect(labels).toContain(
      "attributes['llm']['output_messages'][0]['message']['contents'][0]['message_content']['text']"
    );
    expect(labels).toContain(
      "attributes['llm']['input_messages'][0]['message']['tool_calls'][0]['tool_call']['function']['name']"
    );
    expect(labels).toContain(
      "attributes['retrieval']['documents'][0]['document']['content']"
    );
    expect(labels).toContain(
      "attributes['embedding']['embeddings'][0]['embedding']['text']"
    );
  });

  it("does not generate top-level completions for nested-only conventions", () => {
    const labels = createOpenInferenceAttributeCompletions().map(
      (completion) => completion.label
    );

    expect(labels).not.toContain("attributes['message']['role']");
    expect(labels).not.toContain("attributes['message_content']['data']");
    expect(labels).not.toContain("attributes['tool_call']['function']['name']");
    expect(labels).not.toContain("attributes['document']['content']");
    expect(labels).not.toContain("attributes['embedding']['text']");
    expect(labels).not.toContain("attributes['image']['url']");
    expect(labels).not.toContain("attributes['audio']['mime_type']");
    expect(labels).not.toContain("attributes['openinference']['span']['kind']");
  });

  it("normalizes double-quoted attribute accessors for value lookup", () => {
    expect(
      normalizeOpenInferenceAttributeAccessor('attributes["llm"]["provider"]')
    ).toBe("attributes['llm']['provider']");
  });

  it("normalizes escaped path segments and integer indices", () => {
    expect(
      normalizeOpenInferenceAttributeAccessor(
        String.raw`attributes['llm']['input_messages'][0]["Bob\"s"]`
      )
    ).toBe(String.raw`attributes['llm']['input_messages'][0]['Bob"s']`);
  });

  it("detects quoted values after known attribute comparisons", () => {
    expect(
      getOpenInferenceAttributeValueCompletionContext(
        'attributes["llm"]["provider"] == "op'
      )
    ).toEqual({
      accessor: "attributes['llm']['provider']",
      quote: '"',
      typedText: "op",
    });
  });

  it("does not detect value completions inside longer identifiers", () => {
    expect(
      getOpenInferenceAttributeValueCompletionContext("my_span_kind == 'L")
    ).toBeNull();
  });

  it("suggests enum values for semantic convention attributes", async () => {
    const source = createOpenInferenceAttributeValueCompletionSource();
    const result = await source(
      createCompletionContext("attributes['llm']['provider'] == \"op")
    );

    expect(result).not.toBeNull();
    if (!result) {
      throw new Error("Expected completion result");
    }
    expect(result.from).toBe("attributes['llm']['provider'] == \"".length);
    expect(result.options.map((completion) => completion.label)).toContain(
      "openai"
    );
    expect(result.options.map((completion) => completion.label)).toContain(
      "anthropic"
    );
  });

  it("suggests span kind values for the top-level span_kind field", async () => {
    const source = createOpenInferenceAttributeValueCompletionSource();
    const result = await source(createCompletionContext("span_kind == 'L"));

    expect(result).not.toBeNull();
    if (!result) {
      throw new Error("Expected completion result");
    }
    expect(result.from).toBe("span_kind == '".length);
    expect(result.options.map((completion) => completion.label)).toContain(
      "LLM"
    );
  });

  it("does not suggest span kind values for openinference.span.kind attributes", async () => {
    const source = createOpenInferenceAttributeValueCompletionSource();
    const result = await source(
      createCompletionContext(
        "attributes['openinference']['span']['kind'] == 'L"
      )
    );

    expect(result).toBeNull();
  });

  it("does not suggest MIME values for audio.mime_type", async () => {
    const source = createOpenInferenceAttributeValueCompletionSource();
    const result = await source(
      createCompletionContext("attributes['audio']['mime_type'] == 'text")
    );

    expect(result).toBeNull();
  });

  it("replaces the whole existing quoted value on mid-value accept", async () => {
    const source = createOpenInferenceAttributeValueCompletionSource();
    const text = "span_kind == 'CHAIN'";
    const pos = "span_kind == 'C".length;
    const result = await source(createCompletionContextAt({ text, pos }));

    expect(result).not.toBeNull();
    if (!result) {
      throw new Error("Expected completion result");
    }
    const chainCompletion = result.options.find(
      (completion) => completion.label === "CHAIN"
    );
    expect(chainCompletion).toBeDefined();
    if (!chainCompletion) {
      throw new Error("Expected CHAIN completion");
    }

    expect(
      applyCompletion({
        text,
        completion: chainCompletion,
        from: result.from,
        to: pos,
      })
    ).toBe("span_kind == 'CHAIN'");
  });
});
