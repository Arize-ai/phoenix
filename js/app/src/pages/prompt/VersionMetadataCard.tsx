import { Card, CopyToClipboardButton } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";

/**
 * The metadata of a prompt or decision version, as JSON
 */
export function VersionMetadataCard({
  metadata,
  testId,
}: {
  metadata: unknown;
  testId?: string;
}) {
  const metadataJSON = JSON.stringify(metadata, null, 2);
  return (
    <Card
      title="Metadata"
      collapsible
      testId={testId}
      extra={<CopyToClipboardButton text={metadataJSON} />}
    >
      <JSONBlock value={metadataJSON} />
    </Card>
  );
}
