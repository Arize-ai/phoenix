import { describe, expect, it } from "vitest";

import { materializeEvaluatorContext } from "../evaluatorContext";
import { getEvaluatorSlotDefaults } from "../evaluatorSlotDefaults";

describe("materializeEvaluatorContext", () => {
  it("materializes span and session values with explicit provenance and unset slots", () => {
    const spanContext = materializeEvaluatorContext({
      grain: "span",
      evaluatorMappingSource: {
        grain: "span",
        source: {
          input: { question: "Why?" },
          output: "Because.",
          span: {
            input_value: { question: "Why?" },
            output_value: "Because.",
          },
        },
      },
      inputMapping: {
        pathMapping: { input: "span.input_value" },
        literalMapping: {},
      },
      slotDefaults: getEvaluatorSlotDefaults("span"),
      recordVariableValues: { latency_ms: 842.5 },
    });

    expect(spanContext?.evaluatorInputs).toMatchObject([
      {
        name: "input",
        status: "resolved",
        value: { question: "Why?" },
        provenance: { kind: "path", path: "span.input_value" },
      },
      {
        name: "output",
        status: "resolved",
        value: "Because.",
        provenance: { kind: "path", path: "span.output_value" },
      },
      {
        name: "metadata",
        status: "unset",
        provenance: { kind: "unset" },
      },
    ]);
    expect(spanContext?.values.latency_ms).toBe(842.5);
    expect(Object.hasOwn(spanContext?.values ?? {}, "metadata")).toBe(false);

    const sessionContext = materializeEvaluatorContext({
      grain: "session",
      evaluatorMappingSource: {
        grain: "session",
        source: {
          input: { session_id: "session-1" },
          output: "Goodbye",
          session: { session_id: "session-1", turns: [] },
        },
      },
      inputMapping: { pathMapping: {}, literalMapping: {} },
      slotDefaults: getEvaluatorSlotDefaults("session"),
      recordVariableValues: { first_input: "Hello" },
    });

    expect(sessionContext?.evaluatorInputs[0]).toMatchObject({
      name: "input",
      provenance: { kind: "path", path: "session" },
    });
    expect(sessionContext?.evaluatorInputs[1]).toMatchObject({
      name: "output",
      value: "Goodbye",
      provenance: {
        kind: "derived",
        description: "last turn's output",
      },
    });
    expect(sessionContext?.values.first_input).toBe("Hello");

    const genericContext = materializeEvaluatorContext({
      grain: "span",
      evaluatorMappingSource: {
        grain: "span",
        source: {
          input: { span_id: null },
          output: null,
          span: { span_id: null, output_value: null },
        },
      },
      inputMapping: { pathMapping: {}, literalMapping: {} },
      slotDefaults: getEvaluatorSlotDefaults("span"),
      recordVariableValues: { span_id: null, latency_ms: null },
    });
    expect(genericContext).toMatchObject({
      hasSampledRecord: false,
      values: {},
      evaluatorInputs: [
        { name: "input", status: "unverifiable" },
        { name: "output", status: "unverifiable" },
        { name: "metadata", status: "unset" },
      ],
    });

    expect(
      materializeEvaluatorContext({
        grain: "span",
        evaluatorMappingSource: {
          grain: "session",
          source: { input: {}, output: null, session: {} },
        },
        inputMapping: { pathMapping: {}, literalMapping: {} },
        slotDefaults: getEvaluatorSlotDefaults("span"),
        recordVariableValues: {},
      })
    ).toBeNull();
  });
});
