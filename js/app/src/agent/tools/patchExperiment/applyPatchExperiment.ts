import { commitMutation, fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { applyPatchExperimentMutation } from "./__generated__/applyPatchExperimentMutation.graphql";
import type { applyPatchExperimentSnapshotQuery } from "./__generated__/applyPatchExperimentSnapshotQuery.graphql";
import type { ExperimentSnapshot, PatchExperimentPayload } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
