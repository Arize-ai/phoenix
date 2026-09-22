import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import { commitMutation, graphql, useRelayEnvironment } from "react-relay";
import type { Environment } from "relay-runtime";

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
  getRevisionId,
  children,
}: {
  datasetId: string;
  /** The loaded revision of an example, or undefined once it is gone. */
  getRevisionId: (exampleId: string) => string | undefined;
  children: ReactNode;
}) {
  const environment = useRelayEnvironment();

  const queue = useExpectedOutputQueue((batch) =>
    writeExpectedOutputs({ environment, datasetId, batch, getRevisionId })
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
  batch,
  getRevisionId,
}: {
  environment: Environment;
  datasetId: string;
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

// The payload returns the examples' new revisions in the table's own shape,
// so the rows read the fresh revision id and expected outputs from the Relay store and
// the next write on the same example carries the right revision guard.
const expectedOutputsMutation = graphql`
  mutation PlaygroundExpectedOutputsContextMutation(
    $input: SetDatasetExampleExpectedOutputsInput!
  ) {
    setDatasetExampleExpectedOutputs(input: $input) {
      examples {
        id
        revision {
          revisionId
          expectedOutputs {
            annotationName
            label
            score
            explanation
          }
        }
      }
    }
  }
`;
