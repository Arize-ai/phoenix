import { graphql, useFragment } from "react-relay";

import type { PromptVersionMetadataCard__main$key } from "./__generated__/PromptVersionMetadataCard__main.graphql";
import { VersionMetadataCard } from "./VersionMetadataCard";

export function PromptVersionMetadataCard({
  promptVersion: promptVersionFragment,
}: {
  promptVersion: PromptVersionMetadataCard__main$key;
}) {
  const { metadata } = useFragment<PromptVersionMetadataCard__main$key>(
    graphql`
      fragment PromptVersionMetadataCard__main on PromptVersion {
        metadata
      }
    `,
    promptVersionFragment
  );
  return (
    <VersionMetadataCard
      metadata={metadata}
      testId="prompt-version-metadata-card"
    />
  );
}
