import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { _resetInstanceId, _resetMessageId } from "@phoenix/store";

import { buildDecisionInput, previewDecision } from "../decisionUtils";
import { transformSpanAttributesToPlaygroundInstance } from "../playgroundUtils";
import { basePlaygroundSpan } from "./fixtures";

const systemOneBody = {
  model: "jev-latest",
  state: { complaint: "I was charged twice." },
  questions: {
    department: {
      type: "choice",
      instructions: "Which team?",
      criteria: { billing: "Refunds", technical: null },
    },
    urgent: { type: "noul", instructions: "Urgent?" },
  },
};

function decisionSpan(attributes: Record<string, unknown>) {
  return { ...basePlaygroundSpan, attributes: JSON.stringify(attributes) };
}

describe("decision span replay", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });

  it("rebuilds a TypeSafe System One request from the span", () => {
    const { playgroundInstance, parsingErrors, templateFormat } =
      transformSpanAttributesToPlaygroundInstance(
        decisionSpan({
          openinference: { span: { kind: "DECISION" } },
          decision: {
            system: "typesafe",
            provider: "typesafe",
            model_name: "jev-1.13.0",
            request: { model_name: "jev-latest" },
            response: { model_name: "jev-1.13.0" },
          },
          input: {
            mime_type: "application/json",
            value: JSON.stringify(systemOneBody),
          },
          output: {
            mime_type: "application/json",
            value: '{"model":"jev-1.13.0","answers":{}}',
          },
        })
      );
    expect(parsingErrors).toEqual([]);
    expect(playgroundInstance.model).toMatchObject({
      provider: "TYPESAFE",
      modelName: "jev-latest",
      modelType: "DECISION",
    });
    expect(playgroundInstance.llmModel?.provider).toBe("OPENAI");
    // The structured state opens as JSON with no holes, exactly as sent, in
    // Mustache since nothing in it reads as a tag.
    expect(templateFormat).toBe(TemplateFormats.Mustache);
    expect(playgroundInstance.decisionPrompt?.state).toMatchObject({
      mode: "json",
      json: JSON.stringify(systemOneBody.state, null, 2),
    });
    const input = buildDecisionInput({
      draft: playgroundInstance.decisionPrompt!,
      templateFormat: templateFormat!,
      variables: {},
    });
    expect(input.state).toEqual({ json: systemOneBody.state });
    expect(input.variables).toEqual({});
    expect(input.questions.map((question) => Object.keys(question)[0])).toEqual(
      ["choice", "predicate"]
    );
    expect(playgroundInstance.repetitions[1]).toMatchObject({
      spanId: "fake-span-global-id",
      status: "finished",
      output: '{"model":"jev-1.13.0","answers":{}}',
    });
  });

  it("rebuilds an OpenAI Decisions request from the span without re-interpreting braces as a template", () => {
    const { playgroundInstance, parsingErrors, templateFormat } =
      transformSpanAttributesToPlaygroundInstance(
        decisionSpan({
          openinference: { span: { kind: "DECISION" } },
          decision: {
            provider: "openai",
            request: { model_name: "gpt-6-luna" },
          },
          input: {
            value: JSON.stringify({
              model: "gpt-6-luna",
              input: '{"ticket": "{{raw}}"}',
              questions: [
                { type: "predicate", name: "urgent", instructions: "Urgent?" },
              ],
            }),
          },
        })
      );
    expect(parsingErrors).toEqual([]);
    expect(templateFormat).toBe(TemplateFormats.NONE);
    expect(playgroundInstance.model.provider).toBe("OPENAI");
    expect(playgroundInstance.model.modelName).toBe("gpt-6-luna");
    expect(playgroundInstance.decisionPrompt?.state).toMatchObject({
      mode: "text",
      text: '{"ticket": "{{raw}}"}',
    });
    expect(playgroundInstance.decisionPrompt?.questions[0]).toMatchObject({
      name: "urgent",
      type: "predicate",
    });
    const preview = previewDecision({
      draft: playgroundInstance.decisionPrompt!,
      templateFormat: templateFormat!,
      variables: {},
    });
    expect(preview.ok && preview.rendered.state).toBe('{"ticket": "{{raw}}"}');
  });

  it("replays an object state with a __proto__ key and an array state exactly", () => {
    const replay = (state: string) =>
      transformSpanAttributesToPlaygroundInstance(
        decisionSpan({
          openinference: { span: { kind: "DECISION" } },
          decision: { provider: "typesafe", request: { model_name: "jev" } },
          input: {
            value: `{"state": ${state}, "questions": {"ok": {"type": "noul", "instructions": "Ok?"}}}`,
          },
        })
      );
    for (const state of [
      '{"__proto__": {"x": 1}, "b": [1, "two"]}',
      '[{"role": "user", "content": "hi"}]',
    ]) {
      const { playgroundInstance, templateFormat } = replay(state);
      const preview = previewDecision({
        draft: playgroundInstance.decisionPrompt!,
        templateFormat: templateFormat!,
        variables: {},
      });
      expect(preview.ok).toBe(true);
      expect(JSON.stringify(preview.ok && preview.rendered.state)).toBe(
        JSON.stringify(JSON.parse(state))
      );
      const input = buildDecisionInput({
        draft: playgroundInstance.decisionPrompt!,
        templateFormat: templateFormat!,
        variables: {},
      });
      expect(JSON.stringify(input.state)).toBe(
        JSON.stringify({ json: JSON.parse(state) })
      );
    }
  });

  it("replays a failed call as a failed run rather than an empty one", () => {
    const { playgroundInstance } = transformSpanAttributesToPlaygroundInstance({
      ...decisionSpan({
        openinference: { span: { kind: "DECISION" } },
        decision: {
          provider: "typesafe",
          request: { model_name: "fixture-429" },
        },
        input: { value: JSON.stringify(systemOneBody) },
      }),
      statusCode: "ERROR",
      statusMessage:
        "TypeSafe decision request failed (HTTP 429). The provider rate-limited the request. Wait and retry.",
    });
    expect(playgroundInstance.repetitions[1]).toMatchObject({
      output: null,
      error: {
        title: "Decision failed",
        message: expect.stringContaining("HTTP 429"),
      },
    });
  });

  it("reports what it could not recover and still opens a usable editor", () => {
    const { playgroundInstance, parsingErrors } =
      transformSpanAttributesToPlaygroundInstance(
        decisionSpan({
          openinference: { span: { kind: "DECISION" } },
          decision: { provider: "someday-provider" },
          input: { value: "not json" },
        })
      );
    expect(parsingErrors).toHaveLength(3);
    expect(parsingErrors.join(" ")).toMatch(/provider/);
    expect(parsingErrors.join(" ")).toMatch(/model/);
    expect(parsingErrors.join(" ")).toMatch(/decision prompt/);
    expect(playgroundInstance.model.modelType).toBe("DECISION");
    expect(playgroundInstance.decisionPrompt?.questions.length).toBeGreaterThan(
      0
    );
  });
});
