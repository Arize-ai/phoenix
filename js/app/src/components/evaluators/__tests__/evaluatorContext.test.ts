import { describe, expect, it } from "vitest";

import {
  SESSION_TURN_FIELDS,
  SPAN_ANNOTATION_FIELDS,
  getEvaluatorMetadataEntries,
} from "@phoenix/pages/project/evaluators/evaluatorBoundVariables";
import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { getSampleSessionEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSessionEvaluationContext";
import { getSampleSpanEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
import { getSampleTraceEvaluationContext } from "@phoenix/pages/project/evaluators/sampleTraceEvaluationContext";
import type { EvaluatorMappingSourceState } from "@phoenix/store/evaluatorStore";
import { SPAN_EVALUATOR_MAPPING_SOURCE_DEFAULT } from "@phoenix/store/evaluatorStore";
import type {
  EvaluatorMappingSource,
  EvaluatorInputMapping,
} from "@phoenix/types";

import { materializeEvaluatorContext } from "../evaluatorContext";
import { EVALUATOR_SLOT_NAMES } from "../evaluatorSlotDefaults";

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
            attributes: { input: { value: "Why?" } },
          },
        },
      },
      inputMapping: {
        pathMapping: { input: "metadata.attributes.input.value" },
        literalMapping: {},
      },
    });

    expect(spanContext?.evaluatorInputs).toMatchObject([
      {
        name: "input",
        status: "resolved",
        value: "Why?",
        provenance: { kind: "path", path: "metadata.attributes.input.value" },
      },
      {
        name: "output",
        status: "resolved",
        value: "Because.",
        provenance: { kind: "path", path: "output" },
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
            session_id: "session-1",
            turns: [],
          },
        },
      },
      inputMapping: UNMAPPED,
    });

    // An unmapped slot binds the context key of its own name, so its
    // provenance is that name rather than the record field holding the same
    // value.
    expect(sessionContext?.evaluatorInputs[0]).toMatchObject({
      name: "input",
      value: "Hello",
      provenance: { kind: "path", path: "input" },
    });
    expect(sessionContext?.evaluatorInputs[1]).toMatchObject({
      name: "output",
      value: "Goodbye",
      provenance: { kind: "path", path: "output" },
    });
  });

  it("holds back every preview until a record has been sampled", () => {
    const unsampledContext = materializeEvaluatorContext({
      grain: "span",
      evaluatorMappingSource: {
        grain: "span",
        source: SPAN_EVALUATOR_MAPPING_SOURCE_DEFAULT,
      },
      inputMapping: UNMAPPED,
    });

    expect(unsampledContext).toMatchObject({
      hasSampledRecord: false,
      evaluatorInputs: [
        { name: "input", status: "unverifiable" },
        { name: "output", status: "unverifiable" },
        { name: "metadata", status: "unverifiable" },
      ],
    });
    expect(
      unsampledContext?.vocabulary.every(
        ({ status }) => status === "unverifiable"
      )
    ).toBe(true);
  });

  // The server resolves every path it was given before a literal overwrites
  // anything, and a path that matches nothing raises there — so the pair has
  // to read as a failure here rather than as the literal that never runs.
  it("fails a slot whose set path matches nothing, literal or not", () => {
    const context = materializeEvaluatorContext({
      grain: "span",
      evaluatorMappingSource: {
        grain: "span",
        source: {
          input: "Why?",
          output: "Because.",
          metadata: { latency_ms: 1, attributes: { input: { value: "Why?" } } },
        },
      },
      inputMapping: {
        pathMapping: { input: "metadata.attributes.nonexistent" },
        literalMapping: { input: "pinned" },
      },
    });

    expect(context?.evaluatorInputs[0]).toMatchObject({
      name: "input",
      status: "unresolved",
      provenance: { kind: "path", path: "metadata.attributes.nonexistent" },
    });
    expect(context?.evaluatorInputs[0]).not.toHaveProperty("value");
  });

  it("lets a literal overwrite the path it sits beside once that path resolves", () => {
    const context = materializeEvaluatorContext({
      grain: "span",
      evaluatorMappingSource: {
        grain: "span",
        source: {
          input: "Why?",
          output: "Because.",
          metadata: { latency_ms: 1, attributes: { input: { value: "Why?" } } },
        },
      },
      inputMapping: {
        pathMapping: { input: "metadata.attributes.input.value" },
        literalMapping: { input: "pinned" },
      },
    });

    expect(context?.evaluatorInputs[0]).toMatchObject({
      name: "input",
      status: "resolved",
      value: "pinned",
      provenance: { kind: "literal" },
    });
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
    source: EvaluatorMappingSource<ProjectEvaluatorMappingSourceGrain>;
  }[] = [
    {
      label: "sample span",
      grain: "span",
      source: getSampleSpanEvaluationContext().context,
    },
    {
      label: "sample trace",
      grain: "trace",
      source: getSampleTraceEvaluationContext().context,
    },
    {
      label: "sample session",
      grain: "session",
      source: getSampleSessionEvaluationContext().context,
    },
  ];

  it.each(clientContexts)(
    "$label carries the whole binding surface",
    ({ grain, source }) => {
      const materialized = materializeEvaluatorContext({
        grain,
        // The cast pairs a grain with its own source, which the compiler
        // tracks only once the grain is one grain; the record grains share
        // one shape, so every pairing here is a valid one.
        evaluatorMappingSource: {
          grain,
          source,
        } as EvaluatorMappingSourceState,
        inputMapping: UNMAPPED,
      });

      const metadataNames = getEvaluatorMetadataEntries(grain).map(
        ({ name }) => name
      );
      // The server binds by the three top-level names and nothing else.
      expect(Object.keys(materialized?.values ?? {})).toEqual([
        ...EVALUATOR_SLOT_NAMES,
      ]);
      // Under `metadata`: the grain's vocabulary and its record fields, flat —
      // no grain-named level. A sampled span may also spread its own metadata
      // attribute's keys beside them.
      expect(Object.keys(source.metadata)).toEqual(
        expect.arrayContaining(metadataNames)
      );
      // Read out in the order the authoring surfaces present them in.
      expect(materialized?.vocabulary.map(({ name }) => name)).toEqual(
        metadataNames.map((name) => `metadata.${name}`)
      );
      expect(materialized?.hasSampledRecord).toBe(true);
      // Declared types drive the container badge, so a sampled value has to
      // actually be that type.
      for (const { name, type } of getEvaluatorMetadataEntries(grain)) {
        const value = source.metadata[name];
        if (value === null) {
          continue; // a scalar the sampled record legitimately lacks
        }
        if (type === "object") {
          expect(value, `metadata.${name}`).toBeTypeOf("object");
          expect(Array.isArray(value), `metadata.${name}`).toBe(false);
        } else if (type === "list") {
          expect(Array.isArray(value), `metadata.${name}`).toBe(true);
        } else if (type === "number") {
          expect(value, `metadata.${name}`).toBeTypeOf("number");
        } else {
          expect(value, `metadata.${name}`).toBeTypeOf("string");
        }
      }
      // Entry shapes inside the containers mirror the server's constants.
      const turns = source.metadata.turns;
      if (Array.isArray(turns)) {
        for (const turn of turns) {
          expect(Object.keys(turn as object).sort()).toEqual(
            [...SESSION_TURN_FIELDS].sort()
          );
        }
      }
      const annotations = source.metadata.annotations;
      if (annotations && typeof annotations === "object") {
        for (const entries of Object.values(annotations)) {
          for (const entry of entries as object[]) {
            expect(Object.keys(entry).sort()).toEqual(
              [...SPAN_ANNOTATION_FIELDS].sort()
            );
          }
        }
      }
    }
  );
});
