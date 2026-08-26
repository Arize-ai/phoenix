import { describe, expect, it } from "vitest";

import { getEvaluatorBoundVariables } from "@phoenix/pages/project/evaluators/evaluatorBoundVariables";
import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  getGenericSessionEvaluationContext,
  getSampleSessionEvaluationContext,
} from "@phoenix/pages/project/evaluators/sampleSessionEvaluationContext";
import {
  getGenericSpanEvaluationContext,
  getSampleSpanEvaluationContext,
} from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
import type {
  EvaluatorMappingSource,
  EvaluatorInputMapping,
} from "@phoenix/types";

import { materializeEvaluatorContext } from "../evaluatorContext";
import {
  EVALUATOR_SLOT_NAMES,
  getEvaluatorSlotDefaults,
} from "../evaluatorSlotDefaults";

const UNMAPPED: EvaluatorInputMapping = { pathMapping: {}, literalMapping: {} };

describe("materializeEvaluatorContext", () => {
  it("materializes each slot with the path it reads", () => {
    const spanContext = materializeEvaluatorContext({
      grain: "span",
      evaluatorMappingSource: {
        grain: "span",
        source: {
          input: "Why?",
          output: "Because.",
          metadata: {
            latency_ms: 842.5,
            span: { input_value: "Why?", output_value: "Because." },
          },
        },
      },
      inputMapping: {
        pathMapping: { input: "metadata.span.input_value" },
        literalMapping: {},
      },
      slotDefaults: getEvaluatorSlotDefaults("span"),
    });

    expect(spanContext?.evaluatorInputs).toMatchObject([
      {
        name: "input",
        status: "resolved",
        value: "Why?",
        provenance: { kind: "path", path: "metadata.span.input_value" },
      },
      {
        name: "output",
        status: "resolved",
        value: "Because.",
        provenance: { kind: "path", path: "metadata.span.output_value" },
      },
      {
        name: "metadata",
        status: "resolved",
        provenance: { kind: "path", path: "metadata" },
      },
    ]);
    // The record's own names are reached by path, never by name: binding is
    // the three slots and nothing else.
    expect(
      spanContext?.vocabulary.find(({ name }) => name === "metadata.latency_ms")
    ).toMatchObject({ status: "resolved", value: 842.5 });
    expect(Object.keys(spanContext?.values ?? {})).toEqual([
      ...EVALUATOR_SLOT_NAMES,
    ]);

    const sessionContext = materializeEvaluatorContext({
      grain: "session",
      evaluatorMappingSource: {
        grain: "session",
        source: {
          input: "Hello",
          output: "Goodbye",
          metadata: {
            first_input: "Hello",
            last_output: "Goodbye",
            session: { session_id: "session-1", turns: [] },
          },
        },
      },
      inputMapping: UNMAPPED,
      slotDefaults: getEvaluatorSlotDefaults("session"),
    });

    expect(sessionContext?.evaluatorInputs[0]).toMatchObject({
      name: "input",
      value: "Hello",
      provenance: { kind: "path", path: "metadata.first_input" },
    });
    expect(sessionContext?.evaluatorInputs[1]).toMatchObject({
      name: "output",
      value: "Goodbye",
      provenance: { kind: "path", path: "metadata.last_output" },
    });
  });

  it("holds back every preview until a record has been sampled", () => {
    const genericContext = materializeEvaluatorContext({
      grain: "span",
      evaluatorMappingSource: {
        grain: "span",
        source: getGenericSpanEvaluationContext().context,
      },
      inputMapping: UNMAPPED,
      slotDefaults: getEvaluatorSlotDefaults("span"),
    });

    expect(genericContext).toMatchObject({
      hasSampledRecord: false,
      evaluatorInputs: [
        { name: "input", status: "unverifiable" },
        { name: "output", status: "unverifiable" },
        { name: "metadata", status: "unverifiable" },
      ],
    });
    expect(
      genericContext?.vocabulary.every(
        ({ status }) => status === "unverifiable"
      )
    ).toBe(true);
  });

  it("materializes nothing for a source built for the other grain", () => {
    expect(
      materializeEvaluatorContext({
        grain: "span",
        evaluatorMappingSource: {
          grain: "session",
          source: { input: null, output: null, metadata: {} },
        },
        inputMapping: UNMAPPED,
        slotDefaults: getEvaluatorSlotDefaults("span"),
      })
    ).toBeNull();
  });
});

/**
 * A preview binds exactly the context the client hands the server — nothing
 * fills the vocabulary in on the way through any more. So a context the client
 * can send has to carry the whole binding surface, or a preview would bind less
 * than the live run it stands in for and the author would never see it.
 */
describe("the preview binds what a live run binds", () => {
  const clientContexts: {
    label: string;
    grain: ProjectEvaluatorMappingSourceGrain;
    source: EvaluatorMappingSource<"span" | "session">;
    isSampled: boolean;
  }[] = [
    {
      label: "sample span",
      grain: "span",
      source: getSampleSpanEvaluationContext("").context,
      isSampled: true,
    },
    {
      label: "generic span",
      grain: "span",
      source: getGenericSpanEvaluationContext().context,
      isSampled: false,
    },
    {
      label: "sample session",
      grain: "session",
      source: getSampleSessionEvaluationContext().context,
      isSampled: true,
    },
    {
      label: "generic session",
      grain: "session",
      source: getGenericSessionEvaluationContext().context,
      isSampled: false,
    },
  ];

  it.each(clientContexts)(
    "$label carries the whole binding surface",
    ({ grain, source, isSampled }) => {
      const materialized = materializeEvaluatorContext({
        grain,
        evaluatorMappingSource:
          grain === "span"
            ? { grain, source: source as EvaluatorMappingSource<"span"> }
            : { grain, source: source as EvaluatorMappingSource<"session"> },
        inputMapping: UNMAPPED,
        slotDefaults: getEvaluatorSlotDefaults(grain),
      });

      const vocabularyNames = getEvaluatorBoundVariables(grain).map(
        ({ name }) => name
      );
      // The server binds by the three top-level names and nothing else.
      expect(Object.keys(materialized?.values ?? {})).toEqual([
        ...EVALUATOR_SLOT_NAMES,
      ]);
      // Under `metadata`: the grain's vocabulary flat, and the record nested
      // under the grain's own key.
      expect(Object.keys(source.metadata).sort()).toEqual(
        [...vocabularyNames, grain].sort()
      );
      // Read out in the order the authoring surfaces present them in.
      expect(materialized?.vocabulary.map(({ name }) => name)).toEqual(
        vocabularyNames.map((name) => `metadata.${name}`)
      );
      expect(materialized?.hasSampledRecord).toBe(isSampled);
    }
  );
});
