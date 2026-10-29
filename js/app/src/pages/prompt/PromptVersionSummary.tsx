import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { VersionSummary } from "@phoenix/components/versions/VersionSummary";

import type { PromptVersionSummaryFragment$key } from "./__generated__/PromptVersionSummaryFragment.graphql";
import { PromptVersionTagsList } from "./PromptVersionTagsList";

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
