import { graphql, useFragment } from "react-relay";

import { LatestVersionsList } from "@phoenix/components/versions/LatestVersionsList";

import type { DecisionLatestVersionsList_decision$key } from "./__generated__/DecisionLatestVersionsList_decision.graphql";
import { DecisionVersionSummary } from "./DecisionVersionSummary";

export function DecisionLatestVersionsList({
  decisionRef,
}: {
  decisionRef: DecisionLatestVersionsList_decision$key;
}) {
  const data = useFragment(
    graphql`
      fragment DecisionLatestVersionsList_decision on Decision {
        id
        latestVersions: versions(first: 5) {
          edges {
            node {
              id
              sequenceNumber
              ...DecisionVersionSummary_version
            }
          }
        }
      }
    `,
    decisionRef
  );
  return (
    <LatestVersionsList
      versions={data.latestVersions.edges.map((edge) => edge.node)}
      renderVersion={(version) => (
        <DecisionVersionSummary versionRef={version} />
      )}
      viewAllTo={`/prompts/decisions/${data.id}/versions`}
    />
  );
}
