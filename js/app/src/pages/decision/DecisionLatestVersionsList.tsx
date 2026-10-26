import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { LatestVersionsTimeline } from "@phoenix/pages/prompt/LatestVersionsTimeline";

import type { DecisionLatestVersionsListFragment$key } from "./__generated__/DecisionLatestVersionsListFragment.graphql";
import { DecisionVersionSummary } from "./DecisionVersionSummary";

export function DecisionLatestVersionsList({
  decision,
}: {
  decision: DecisionLatestVersionsListFragment$key;
}) {
  const data = useFragment<DecisionLatestVersionsListFragment$key>(
    graphql`
      fragment DecisionLatestVersionsListFragment on Decision {
        latestVersions: versions(first: 5) {
          edges {
            version: node {
              id
              sequenceNumber
              ...DecisionVersionSummaryFragment
            }
          }
        }
      }
    `,
    decision
  );
  const items = useMemo(
    () =>
      data.latestVersions.edges.map(({ version }) => ({
        id: version.id,
        sequenceNumber: version.sequenceNumber,
        summary: <DecisionVersionSummary decisionVersion={version} />,
      })),
    [data]
  );
  return <LatestVersionsTimeline items={items} />;
}
