import { graphql, useFragment } from "react-relay";

import { VersionSummary } from "@phoenix/components/versions/VersionSummary";
import { TagVersionLabel } from "@phoenix/pages/prompt/PromptVersionTagsList";

import type { DecisionVersionSummary_version$key } from "./__generated__/DecisionVersionSummary_version.graphql";

export function DecisionVersionSummary({
  versionRef,
}: {
  versionRef: DecisionVersionSummary_version$key;
}) {
  const version = useFragment(
    graphql`
      fragment DecisionVersionSummary_version on DecisionVersion {
        id
        description
        sequenceNumber
        createdAt
        user {
          username
          profilePictureUrl
        }
        tags {
          id
          name
        }
      }
    `,
    versionRef
  );
  return (
    <VersionSummary
      id={version.id}
      sequenceNumber={version.sequenceNumber}
      description={version.description}
      createdAt={version.createdAt}
      user={version.user}
      tags={version.tags.map((tag) => (
        <TagVersionLabel key={tag.id}>{tag.name}</TagVersionLabel>
      ))}
    />
  );
}
