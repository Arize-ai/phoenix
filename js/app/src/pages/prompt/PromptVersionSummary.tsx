import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import type { PromptVersionSummaryFragment$key } from "./__generated__/PromptVersionSummaryFragment.graphql";
import { PromptVersionTagsList } from "./PromptVersionTagsList";
import { VersionSummary } from "./VersionSummary";

export function PromptVersionSummary(props: {
  promptVersion: PromptVersionSummaryFragment$key;
}) {
  const version = useFragment<PromptVersionSummaryFragment$key>(
    graphql`
      fragment PromptVersionSummaryFragment on PromptVersion {
        id
        description
        sequenceNumber
        createdAt
        user {
          id
          username
          profilePictureUrl
        }
        ...PromptVersionTagsList_data
      }
    `,
    props.promptVersion
  );

  return (
    <VersionSummary
      id={version.id}
      sequenceNumber={version.sequenceNumber}
      description={version.description}
      createdAt={version.createdAt}
      user={version.user}
      tags={<PromptVersionTagsList promptVersion={version} />}
    />
  );
}
