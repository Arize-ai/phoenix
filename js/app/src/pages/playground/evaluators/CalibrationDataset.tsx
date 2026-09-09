import { useEffect } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import type { CalibrationDatasetQuery } from "./__generated__/CalibrationDatasetQuery.graphql";
import type { CalibrationExample } from "./calibration";

/** Retain the query while the workspace owns its fixed sample. */
export function CalibrationDataset({
  datasetId,
  splitIds,
  versionId,
  onLoad,
  fetchKey,
  first,
}: {
  fetchKey: string;
  datasetId: string;
  /** How many examples to load — the sample size. */
  first: number;
  splitIds: string[];
  versionId: string | null;
  onLoad: (examples: CalibrationExample[]) => void;
}) {
  const data = useLazyLoadQuery<CalibrationDatasetQuery>(
    graphql`
      query CalibrationDatasetQuery(
        $datasetId: ID!
        $splitIds: [ID!]!
        $versionId: ID
        $first: Int!
      ) {
        node(id: $datasetId) {
          ... on Dataset {
            examples(
              first: $first
              splitIds: $splitIds
              datasetVersionId: $versionId
            ) {
              edges {
                node {
                  id
                  revision {
                    revisionId
                    input
                    output
                    metadata
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
          }
        }
      }
    `,
    { datasetId, splitIds, versionId, first },
    { fetchPolicy: "network-only", fetchKey }
  );
  // Synchronize a retained query with the parent-owned execution snapshot. Later
  // Relay writes must not silently change the sample underneath a running draft.
  useEffect(() => {
    onLoad(
      data.node?.examples?.edges.map(({ node }) => ({
        id: node.id,
        ...node.revision,
      })) ?? []
    );
    // This component is keyed by dataset, split and version selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
