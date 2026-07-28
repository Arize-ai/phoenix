import { Card } from "@phoenix/components";

import { ReadonlyJSONBlock } from "../ReadonlyJSONBlock";
import { defaultCardProps } from "./constants";

/**
 * A card that displays the metadata attribute of a span as JSON.
 */
export function SpanMetadata({ metadata }: { metadata: unknown }) {
  return (
    <Card {...defaultCardProps} title="Metadata">
      <ReadonlyJSONBlock>{JSON.stringify(metadata)}</ReadonlyJSONBlock>
    </Card>
  );
}
