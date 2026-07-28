import { Card } from "@phoenix/components";

import { ReadonlyJSONBlock } from "../ReadonlyJSONBlock";
import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { defaultCardProps } from "./constants";

/**
 * A card that displays the metadata attribute of a span as JSON.
 */
export function SpanMetadata({ metadata }: { metadata: unknown }) {
  const cardProps = useSpanInfoCardProps("metadata");
  return (
    <Card {...defaultCardProps} {...cardProps} title="Metadata">
      <ReadonlyJSONBlock>{JSON.stringify(metadata)}</ReadonlyJSONBlock>
    </Card>
  );
}
