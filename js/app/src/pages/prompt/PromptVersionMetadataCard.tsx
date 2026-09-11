import { graphql, useFragment } from "react-relay";

import { Card, CopyToClipboardButton } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";

import type { PromptVersionMetadataCard__main$key } from "./__generated__/PromptVersionMetadataCard__main.graphql";

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
  const metadataJSON = JSON.stringify(metadata, null, 2);
  return (
    <Card
      title="Metadata"
      collapsible
      testId="prompt-version-metadata-card"
      extra={<CopyToClipboardButton text={metadataJSON} />}
    >
      <JSONBlock value={metadataJSON} />
    </Card>
  );
}
