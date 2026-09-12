import { graphql, useRelayEnvironment } from "react-relay";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { useEvaluatorPlaygroundExpectedOutputsCreateSpanMutation } from "./__generated__/useEvaluatorPlaygroundExpectedOutputsCreateSpanMutation.graphql";
import type { useEvaluatorPlaygroundExpectedOutputsDatasetMutation } from "./__generated__/useEvaluatorPlaygroundExpectedOutputsDatasetMutation.graphql";
import type { useEvaluatorPlaygroundExpectedOutputsDeleteSpanMutation } from "./__generated__/useEvaluatorPlaygroundExpectedOutputsDeleteSpanMutation.graphql";
import type { useEvaluatorPlaygroundExpectedOutputsPatchSpanMutation } from "./__generated__/useEvaluatorPlaygroundExpectedOutputsPatchSpanMutation.graphql";
import type { EvaluatorPlaygroundSource } from "./evaluatorPlaygroundSource";
import type { SampleExample } from "./evaluatorResults";
import type { PendingExpectedOutputs } from "./expectedOutputQueue";
import {
  applySpanAnnotationWrites,
  planSpanAnnotationWrites,
  type SavedSpanAnnotation,
} from "./spanSampleRows";
import { commitEvaluatorMutation } from "./useEvaluatorSlotSave";

type DatasetLabelInput =
  useEvaluatorPlaygroundExpectedOutputsDatasetMutation["variables"]["input"]["labels"][number];

/** The sample as of the latest render, read when a batch actually goes out. */
export type LatestSample = {
  source: EvaluatorPlaygroundSource | null;
  rows: SampleExample[];
};

/**
 * Writes a batch of expected outputs to wherever the rows came from. On a
 * dataset that is one calibration-labels mutation and one new version; on a
 * project it is HUMAN span annotations named after the evaluator: created,
 * patched by id, or deleted. Either way the rows are updated afterwards so the
 * next batch addresses the right revision or annotation.
 */
export function useEvaluatorPlaygroundExpectedOutputs({
  getLatest,
  updateRows,
}: {
  getLatest: () => LatestSample;
  updateRows: (update: (rows: SampleExample[]) => SampleExample[]) => void;
}) {
  const environment = useRelayEnvironment();

  async function flush(
    batch: PendingExpectedOutputs
  ): Promise<UIOperationResult> {
    const { source, rows } = getLatest();

    if (!source)
      return { ok: false, error: "No dataset or project is selected." };

    try {
      return source.kind === "dataset"
        ? await flushDataset(source.datasetId, batch, rows)
        : await flushSpans(batch, rows);
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? (getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
              error.message)
            : String(error),
      };
    }
  }

  /** One mutation, one dataset version, for every annotation in the batch. */
  async function flushDataset(
    datasetId: string,
    batch: PendingExpectedOutputs,
    rows: SampleExample[]
  ): Promise<UIOperationResult> {
    const labels: DatasetLabelInput[] = [];

    for (const [exampleId, byName] of Object.entries(batch)) {
      const example = rows.find((item) => item.id === exampleId);

      if (!example)
        return {
          ok: false,
          error:
            "An annotated example is no longer in the sample. Load the latest sample and try again.",
        };

      for (const [annotationName, output] of Object.entries(byName))
        labels.push({
          exampleId,
          expectedRevisionId: example.revisionId,
          annotationName,
          label: output?.label ?? null,
          score: output?.score ?? null,
          explanation: output?.explanation ?? null,
        });
    }

    if (!labels.length) return { ok: true };

    const response =
      await commitEvaluatorMutation<useEvaluatorPlaygroundExpectedOutputsDatasetMutation>(
        environment,
        datasetMutation,
        { input: { datasetId, labels } }
      );

    const saved = new Map(
      response.setDatasetExampleCalibrationLabels.examples.map((item) => [
        item.id,
        item.revision,
      ])
    );

    // Fold the new revisions into the sample so later annotations on these
    // examples carry the right expected revision.
    updateRows((current) =>
      current.map((item) => {
        const revision = saved.get(item.id);

        return revision ? { ...item, ...revision } : item;
      })
    );

    return { ok: true, output: { saved: saved.size } };
  }

  /**
   * Creates, patches and deletes go out in that order, each only when needed.
   * The annotations are `source: APP`, HUMAN, with empty metadata, so they
   * read as a person's judgment made in the app.
   */
  async function flushSpans(
    batch: PendingExpectedOutputs,
    rows: SampleExample[]
  ): Promise<UIOperationResult> {
    const planned = planSpanAnnotationWrites(batch, rows);

    if (!planned.ok) return planned;
    const { creates, patches, deleteIds } = planned.plan;
    const saved: SavedSpanAnnotation[] = [];

    if (creates.length) {
      const response =
        await commitEvaluatorMutation<useEvaluatorPlaygroundExpectedOutputsCreateSpanMutation>(
          environment,
          createSpanMutation,
          {
            input: creates.map((create) => ({
              ...create,
              annotatorKind: "HUMAN",
              source: "APP",
              metadata: {},
            })),
          }
        );

      saved.push(...response.createSpanAnnotations.spanAnnotations);
    }

    if (patches.length) {
      const response =
        await commitEvaluatorMutation<useEvaluatorPlaygroundExpectedOutputsPatchSpanMutation>(
          environment,
          patchSpanMutation,
          { input: patches }
        );

      saved.push(...response.patchSpanAnnotations.spanAnnotations);
    }

    if (deleteIds.length)
      await commitEvaluatorMutation<useEvaluatorPlaygroundExpectedOutputsDeleteSpanMutation>(
        environment,
        deleteSpanMutation,
        { input: { annotationIds: deleteIds } }
      );
    updateRows((current) =>
      applySpanAnnotationWrites(current, { saved, deleteIds })
    );

    return { ok: true, output: { saved: saved.length + deleteIds.length } };
  }

  return { flush };
}

const datasetMutation = graphql`
  mutation useEvaluatorPlaygroundExpectedOutputsDatasetMutation(
    $input: SetDatasetExampleCalibrationLabelsInput!
  ) {
    setDatasetExampleCalibrationLabels(input: $input) {
      examples {
        id
        revision {
          revisionId
          calibrationLabels {
            annotationName
            score
            explanation
            label
          }
        }
      }
    }
  }
`;

const createSpanMutation = graphql`
  mutation useEvaluatorPlaygroundExpectedOutputsCreateSpanMutation(
    $input: [CreateSpanAnnotationInput!]!
  ) {
    createSpanAnnotations(input: $input) {
      spanAnnotations {
        id
        spanId
        name
        label
        score
        explanation
      }
    }
  }
`;

const patchSpanMutation = graphql`
  mutation useEvaluatorPlaygroundExpectedOutputsPatchSpanMutation(
    $input: [PatchAnnotationInput!]!
  ) {
    patchSpanAnnotations(input: $input) {
      spanAnnotations {
        id
        spanId
        name
        label
        score
        explanation
      }
    }
  }
`;

const deleteSpanMutation = graphql`
  mutation useEvaluatorPlaygroundExpectedOutputsDeleteSpanMutation(
    $input: DeleteAnnotationsInput!
  ) {
    deleteSpanAnnotations(input: $input) {
      spanAnnotations {
        id
      }
    }
  }
`;
