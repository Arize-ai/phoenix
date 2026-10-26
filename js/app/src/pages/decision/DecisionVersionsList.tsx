import { graphql, useFragment } from "react-relay";

import { VersionItem, VersionsList } from "@phoenix/pages/prompt/VersionsList";

import type { DecisionVersionsList__main$key } from "./__generated__/DecisionVersionsList__main.graphql";
import { DecisionVersionSummary } from "./DecisionVersionSummary";

/**
 * Full height, scrollable, list of decision versions
 */
export function DecisionVersionsList({
  decision,
  activeVersionId,
}: {
  decision: DecisionVersionsList__main$key;
  activeVersionId?: string;
}) {
  const { versions } = useFragment<DecisionVersionsList__main$key>(
    graphql`
      fragment DecisionVersionsList__main on Decision {
        versions(first: 100) {
          edges {
            version: node {
              id
              ...DecisionVersionSummaryFragment
            }
          }
        }
      }
    `,
    decision
  );
  return (
    <VersionsList>
      {versions.edges.map(({ version }) => (
        <VersionItem
          key={version.id}
          versionId={version.id}
          active={version.id === activeVersionId}
        >
          <DecisionVersionSummary decisionVersion={version} />
        </VersionItem>
      ))}
    </VersionsList>
  );
}
