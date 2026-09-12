import { isStringKeyedObject } from "@phoenix/typeUtils";

import type { SampleExample, SampleExpectedOutput } from "./evaluatorResults";
import type { PendingExpectedOutputs } from "./expectedOutputQueue";

/** A span as the project sample query returns it. */
export type SpanSampleNode = {
  id: string;
  name: string;
  evaluationContext: unknown;
  spanAnnotations: ReadonlyArray<{
    id: string;
    name: string;
    annotatorKind: string;
    label: string | null;
    score: number | null;
    explanation: string | null;
  }>;
};

/**
 * A span as a sample row. `evaluationContext` is the server's span evaluation
 * context, so `input`, `output` and `metadata` line up with an example's. Only
 * HUMAN annotations count as expected outputs: they are what the playground
 * writes, and an LLM or CODE annotation is somebody else's judgment.
 */
export function createSpanSampleRow(span: SpanSampleNode): SampleExample {
  const context = isStringKeyedObject(span.evaluationContext)
    ? span.evaluationContext
    : {};

  return {
    id: span.id,
    revisionId: span.id,
    name: span.name,
    input: context.input,
    output: context.output,
    metadata: context.metadata,
    calibrationLabels: span.spanAnnotations
      .filter((annotation) => annotation.annotatorKind === "HUMAN")
      .map((annotation) => ({
        annotationId: annotation.id,
        annotationName: annotation.name,
        label: annotation.label,
        score: annotation.score,
        explanation: annotation.explanation,
      })),
  };
}

type AnnotationValues = {
  label: string | null;
  score: number | null;
  explanation: string | null;
};

/** The span annotation mutations one batch of expected outputs needs. */
export type SpanAnnotationWritePlan = {
  creates: (AnnotationValues & { spanId: string; name: string })[];
  patches: (AnnotationValues & { annotationId: string })[];
  deleteIds: string[];
};

/**
 * Turns a batch of expected outputs into creates, patches and deletes against
 * the HUMAN annotations the rows already carry. A row that has left the sample
 * fails the whole batch, as the dataset path does, so nothing is written
 * against a span the table no longer shows.
 */
export function planSpanAnnotationWrites(
  batch: PendingExpectedOutputs,
  rows: readonly SampleExample[]
): { ok: true; plan: SpanAnnotationWritePlan } | { ok: false; error: string } {
  const plan: SpanAnnotationWritePlan = {
    creates: [],
    patches: [],
    deleteIds: [],
  };

  for (const [spanId, byName] of Object.entries(batch)) {
    const row = rows.find((item) => item.id === spanId);

    if (!row)
      return {
        ok: false,
        error:
          "An annotated span is no longer in the sample. Load the latest sample and try again.",
      };

    for (const [name, output] of Object.entries(byName)) {
      const existing = row.calibrationLabels.find(
        (label) => label.annotationName === name && label.annotationId
      );

      if (!output) {
        if (existing?.annotationId) plan.deleteIds.push(existing.annotationId);

        continue;
      }

      const values: AnnotationValues = {
        label: output.label ?? null,
        score: output.score ?? null,
        explanation: output.explanation ?? null,
      };

      if (existing?.annotationId)
        plan.patches.push({ annotationId: existing.annotationId, ...values });
      else plan.creates.push({ spanId, name, ...values });
    }
  }

  return { ok: true, plan };
}

/** A span annotation as a create or patch mutation returns it. */
export type SavedSpanAnnotation = AnnotationValues & {
  id: string;
  spanId: string;
  name: string;
};

/**
 * Folds the server's answer back into the rows, so a later change or clear
 * addresses the annotation the server created rather than asking for another.
 */
export function applySpanAnnotationWrites(
  rows: readonly SampleExample[],
  {
    saved,
    deleteIds,
  }: { saved: readonly SavedSpanAnnotation[]; deleteIds: readonly string[] }
): SampleExample[] {
  return rows.map((row) => {
    const own = saved.filter((annotation) => annotation.spanId === row.id);

    const hasDeleted = row.calibrationLabels.some(
      (label) => label.annotationId && deleteIds.includes(label.annotationId)
    );

    if (!own.length && !hasDeleted) return row;

    const kept: SampleExpectedOutput[] = row.calibrationLabels
      .filter(
        (label) =>
          !label.annotationId ||
          (!deleteIds.includes(label.annotationId) &&
            !own.some((annotation) => annotation.id === label.annotationId))
      )
      // A create answers a name the row had no persisted annotation for yet.
      .filter(
        (label) =>
          !own.some((annotation) => annotation.name === label.annotationName)
      );

    return {
      ...row,
      calibrationLabels: [
        ...kept,
        ...own.map((annotation) => ({
          annotationId: annotation.id,
          annotationName: annotation.name,
          label: annotation.label,
          score: annotation.score,
          explanation: annotation.explanation,
        })),
      ],
    };
  });
}
