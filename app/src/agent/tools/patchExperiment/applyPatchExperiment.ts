import { commitMutation, fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { applyPatchExperimentMutation } from "./__generated__/applyPatchExperimentMutation.graphql";
import type { applyPatchExperimentSnapshotQuery } from "./__generated__/applyPatchExperimentSnapshotQuery.graphql";
import type { ExperimentSnapshot, PatchExperimentPayload } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Fetches the target experiment's editable fields plus its `updatedAt` token.
 * The snapshot is taken at propose time for the card preview and re-fetched at
 * accept time to detect drift before committing.
 */
export async function fetchExperimentSnapshot(
  experimentId: string
): Promise<ExperimentSnapshot> {
  const data = await fetchQuery<applyPatchExperimentSnapshotQuery>(
    RelayEnvironment,
    graphql`
      query applyPatchExperimentSnapshotQuery($experimentId: ID!) {
        experiment: node(id: $experimentId) {
          __typename
          ... on Experiment {
            name
            description
            metadata
            updatedAt
          }
        }
      }
    `,
    { experimentId }
  ).toPromise();

  if (data?.experiment?.__typename !== "Experiment") {
    throw new Error("Could not resolve experimentId to an experiment.");
  }
  const { name, description, metadata, updatedAt } = data.experiment;
  return {
    name,
    description: description ?? null,
    metadata: isRecord(metadata) ? metadata : {},
    updatedAt,
  };
}

/**
 * Commits the experiment patch with the stored payload. The server replaces
 * metadata as a whole object and treats an omitted field as unchanged; only
 * the keys present in `payload` are sent.
 */
export function commitPatchExperiment({
  experimentId,
  payload,
}: {
  experimentId: string;
  payload: PatchExperimentPayload;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    commitMutation<applyPatchExperimentMutation>(RelayEnvironment, {
      mutation: graphql`
        mutation applyPatchExperimentMutation($input: PatchExperimentInput!) {
          patchExperiment(input: $input) {
            experiment {
              id
              name
              description
              metadata
              updatedAt
            }
          }
        }
      `,
      variables: {
        input: {
          experimentId,
          ...("name" in payload ? { name: payload.name } : {}),
          ...("description" in payload
            ? { description: payload.description }
            : {}),
          ...("metadata" in payload ? { metadata: payload.metadata } : {}),
        },
      },
      onCompleted: (_response, errors) => {
        const message = errors?.find((error) => error.message)?.message;
        if (message) {
          reject(new Error(message));
          return;
        }
        resolve();
      },
      onError: reject,
    });
  });
}
