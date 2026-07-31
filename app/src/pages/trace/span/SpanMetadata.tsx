import { CopyToClipboardButton } from "@phoenix/components";

import { ReadonlyJSONBlock } from "../ReadonlyJSONBlock";
import { SpanDetailsDisclosureSection } from "../SpanDetailsDisclosureSection";
import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { ExpandableSpanContent } from "./ExpandableSpanContent";
import type { SpanInfoSectionProps } from "./types";
import { formatJSONForCopy } from "./utils";

/**
 * A card that displays the metadata attribute of a span as JSON.
 */
export function SpanMetadata({
  metadata,
  sectionId,
  bordered,
}: {
  metadata: unknown;
} & SpanInfoSectionProps) {
  const cardProps = useSpanInfoCardProps("metadata");
  return (
    <SpanDetailsDisclosureSection
      sectionId={sectionId}
      bordered={bordered}
      {...cardProps}
      title="Metadata"
      extra={<CopyToClipboardButton text={formatJSONForCopy(metadata)} />}
    >
      <ExpandableSpanContent>
        <ReadonlyJSONBlock>{JSON.stringify(metadata)}</ReadonlyJSONBlock>
      </ExpandableSpanContent>
    </SpanDetailsDisclosureSection>
  );
}
