import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import { commitMutation, graphql, useRelayEnvironment } from "react-relay";
import type { Environment, RecordSourceSelectorProxy } from "relay-runtime";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";

import type { ExpectedOutput } from "../evaluators/evaluatorResults";
import {
  type ExpectedOutputQueueState,
  type PendingExpectedOutputs,
  useExpectedOutputQueue,
} from "../evaluators/expectedOutputQueue";
import type {
  PlaygroundExpectedOutputsContextMutation,
  PlaygroundExpectedOutputsContextMutation$variables,
} from "./__generated__/PlaygroundExpectedOutputsContextMutation.graphql";

export type PlaygroundExpectedOutputs = ExpectedOutputQueueState & {
  /**
   * Record `output` (null clears) as the example's expected output. It shows
   * as recorded at once and is written with the next batch.
   */
  save: (
    exampleId: string,
    annotationName: string,
    output: ExpectedOutput | null
  ) => Promise<UIOperationResult>;
  /**
   * Record `output` and write it now, with whatever else is queued, resolving
   * with the write's outcome. For callers that need the result, such as PXI.
   */
  saveNow: (
    exampleId: string,
    annotationName: string,
    output: ExpectedOutput | null
  ) => Promise<UIOperationResult>;
  /** Write whatever is queued now, after a failed batch. */
  retry: () => Promise<UIOperationResult>;
};

const PlaygroundExpectedOutputsContext =
  createContext<PlaygroundExpectedOutputs | null>(null);

/**
 * The expected outputs of the dataset table's examples: what is queued to be
 * written, and the writer. Expected outputs are HUMAN annotations on the
 * example, written in batches through setDatasetExampleExpectedOutputs
 * with a revision guard, so the writer reads each example's current revision
 * from the table.
 */
export function PlaygroundExpectedOutputsProvider({
  datasetId,
  splitIds,
  getRevisionId,
  children,
}: {
  datasetId: string;
  /** The splits the table reads, which key the dataset's expected outputs list. */
  splitIds: ReadonlyArray<string> | null;
  /** The loaded revision of an example, or undefined once it is gone. */
  getRevisionId: (exampleId: string) => string | undefined;
  children: ReactNode;
}) {
  const environment = useRelayEnvironment();

  const queue = useExpectedOutputQueue((batch) =>
    writeExpectedOutputs({
      environment,
      datasetId,
      splitIds,
      batch,
      getRevisionId,
    })
  );

  const { enqueue, flushNow, overlay, pendingCount, isSaving, status, error } =
    queue;

  const save = useCallback<PlaygroundExpectedOutputs["save"]>(
    (exampleId, annotationName, output) => {
      enqueue(exampleId, annotationName, output);

      return Promise.resolve({ ok: true });
    },
    [enqueue]
  );

  const saveNow = useCallback<PlaygroundExpectedOutputs["saveNow"]>(
    (exampleId, annotationName, output) => {
      enqueue(exampleId, annotationName, output);

      return flushNow();
    },
    [enqueue, flushNow]
  );

  const value = useMemo<PlaygroundExpectedOutputs>(
    () => ({
      overlay,
      pendingCount,
      isSaving,
      status,
      error,
      save,
      saveNow,
      retry: flushNow,
    }),
    [overlay, pendingCount, isSaving, status, error, save, saveNow, flushNow]
  );

  return (
    <PlaygroundExpectedOutputsContext.Provider value={value}>
      {children}
    </PlaygroundExpectedOutputsContext.Provider>
  );
}

export function usePlaygroundExpectedOutputs(): PlaygroundExpectedOutputs {
  const value = useContext(PlaygroundExpectedOutputsContext);

  if (!value) {
    throw new Error("Missing PlaygroundExpectedOutputsProvider in the tree");
  }

  return value;
}

type ExpectedOutputInput =
  PlaygroundExpectedOutputsContextMutation$variables["input"]["expectedOutputs"][number];

/** One mutation, one dataset version, for every annotation in the batch. */
function writeExpectedOutputs({
  environment,
  datasetId,
  splitIds,
  batch,
  getRevisionId,
}: {
  environment: Environment;
  datasetId: string;
  splitIds: ReadonlyArray<string> | null;
  batch: PendingExpectedOutputs;
  getRevisionId: (exampleId: string) => string | undefined;
}): Promise<UIOperationResult> {
  const expectedOutputs: ExpectedOutputInput[] = [];

  for (const [exampleId, byName] of Object.entries(batch)) {
    const expectedRevisionId = getRevisionId(exampleId);

    if (expectedRevisionId == null) {
      return Promise.resolve({
        ok: false,
        error:
          "An annotated example is no longer loaded. Reload the examples and try again.",
      });
    }

    for (const [annotationName, output] of Object.entries(byName)) {
      expectedOutputs.push({
        exampleId,
        expectedRevisionId,
        annotationName,
        label: output?.label ?? null,
        score: output?.score ?? null,
        explanation: output?.explanation ?? null,
      });
    }
  }

  if (expectedOutputs.length === 0) {
    return Promise.resolve({ ok: true });
  }

  return new Promise((resolve) => {
    commitMutation<PlaygroundExpectedOutputsContextMutation>(environment, {
      mutation: expectedOutputsMutation,
      variables: { input: { datasetId, expectedOutputs } },
      updater: (store) =>
        addNewlyAnnotatedExamples({ store, datasetId, splitIds }),
      onCompleted: (response, errors) => {
        if (errors?.length) {
          resolve({
            ok: false,
            error: errors.map((error) => error.message).join("\n"),
          });

          return;
        }

        resolve({
          ok: true,
          output: {
            saved: response.setDatasetExampleExpectedOutputs.examples.length,
          },
        });
      },
      onError: (error) => resolve({ ok: false, error: error.message }),
    });
  });
}

/**
 * The written examples' expected outputs come back under the IDs the
 * dataset's list uses, so the store updates the ones already listed. An
 * example annotated for the first time is not in the list yet; it is added
 * here, so the evaluator headers count it without a refetch.
 */
function addNewlyAnnotatedExamples({
  store,
  datasetId,
  splitIds,
}: {
  store: RecordSourceSelectorProxy;
  datasetId: string;
  splitIds: ReadonlyArray<string> | null;
}) {
  const written =
    store
      .getRootField("setDatasetExampleExpectedOutputs")
      ?.getLinkedRecords("exampleExpectedOutputs") ?? [];
  const dataset = store.get(datasetId);
  const listArgs = { splitIds };
  const listed = dataset?.getLinkedRecords("exampleExpectedOutputs", listArgs);

  if (!dataset || !listed) {
    return;
  }

  const listedIds = new Set(listed.map((record) => record?.getDataID()));
  const added = written.filter(
    (record) => record != null && !listedIds.has(record.getDataID())
  );

  if (added.length > 0) {
    dataset.setLinkedRecords(
      [...listed, ...added],
      "exampleExpectedOutputs",
      listArgs
    );
  }
}

// The payload returns the examples' new revisions in the table's own shape,
// so the rows read the fresh revision from the Relay store without a reload:
// the expected outputs, the metadata they are recorded in (which the metadata
// column shows when asked), and the revision id the next write on the same
// example must carry as its guard. The expected outputs come back a second
// time as items of the dataset's list, which the evaluator headers count.
const expectedOutputsMutation = graphql`
  mutation PlaygroundExpectedOutputsContextMutation(
    $input: SetDatasetExampleExpectedOutputsInput!
  ) {
    setDatasetExampleExpectedOutputs(input: $input) {
      examples {
        id
        revision {
          input
          output
          metadata
          revisionId
          expectedOutputs {
            annotationName
            label
            score
            explanation
          }
        }
      }
      exampleExpectedOutputs {
        id
        exampleId
        expectedOutputs {
          annotationName
          label
          score
          explanation
        }
      }
    }
  }
`;
