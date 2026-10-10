import { _resetInstanceId, _resetMessageId } from "@phoenix/store";

import { buildDecisionRequest } from "../decisionUtils";
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
    const { playgroundInstance, parsingErrors } =
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
    const request = buildDecisionRequest(playgroundInstance.decisionRequest!);
    expect(request.state).toEqual({ complaint: "I was charged twice." });
    expect(Object.keys(request.questions)).toEqual(["department", "urgent"]);
    expect(request.questions.department).toEqual(
      systemOneBody.questions.department
    );
    expect(playgroundInstance.repetitions[1]).toMatchObject({
      spanId: "fake-span-global-id",
      status: "finished",
      output: '{"model":"jev-1.13.0","answers":{}}',
    });
  });

  it("rebuilds an OpenAI Decisions request from the span", () => {
    const { playgroundInstance, parsingErrors } =
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
              input: "I was charged twice.",
              questions: [
                { type: "predicate", name: "urgent", instructions: "Urgent?" },
              ],
            }),
          },
        })
      );
    expect(parsingErrors).toEqual([]);
    expect(playgroundInstance.model.provider).toBe("OPENAI");
    expect(playgroundInstance.model.modelName).toBe("gpt-6-luna");
    expect(playgroundInstance.decisionRequest?.stateFormat).toBe("text");
    expect(playgroundInstance.decisionRequest?.questions[0]).toMatchObject({
      name: "urgent",
      type: "noul",
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
    expect(parsingErrors.join(" ")).toMatch(/request/);
    expect(playgroundInstance.model.modelType).toBe("DECISION");
    expect(
      playgroundInstance.decisionRequest?.questions.length
    ).toBeGreaterThan(0);
  });
});
