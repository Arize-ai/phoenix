import { graphql, useFragment } from "react-relay";

import { VersionSummary } from "@phoenix/pages/prompt/VersionSummary";

import type { DecisionVersionSummaryFragment$key } from "./__generated__/DecisionVersionSummaryFragment.graphql";
import { DecisionVersionTagsList } from "./DecisionVersionTagsList";

export function DecisionVersionSummary({
  decisionVersion,
}: {
  decisionVersion: DecisionVersionSummaryFragment$key;
}) {
  const version = useFragment<DecisionVersionSummaryFragment$key>(
    graphql`
      fragment DecisionVersionSummaryFragment on DecisionVersion {
        id
        description
        sequenceNumber
        createdAt
        user {
          id
          username
          profilePictureUrl
        }
        ...DecisionVersionTagsList_data
      }
    `,
    decisionVersion
  );
  return (
    <VersionSummary
      id={version.id}
      sequenceNumber={version.sequenceNumber}
      description={version.description}
      createdAt={version.createdAt}
      user={version.user}
      tags={<DecisionVersionTagsList decisionVersion={version} />}
    />
  );
}
