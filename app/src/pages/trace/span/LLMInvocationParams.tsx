import {
  Card,
  CopyToClipboardButton,
  ExpandableContent,
} from "@phoenix/components";

import { ReadonlyJSONBlock } from "../ReadonlyJSONBlock";
import { defaultCardProps } from "./constants";

const INVOCATION_PARAMETERS_COLLAPSED_HEIGHT_PIXELS = 320;

/**
 * Displays an LLM span's invocation parameters inline in an expandable card.
 */
export function LLMInvocationParams({
  invocationParameters,
}: {
  /** The invocation parameters as a JSON string */
  invocationParameters: string;
}) {
  return (
    <Card
      {...defaultCardProps}
      title="Invocation Parameters"
      extra={<CopyToClipboardButton text={invocationParameters} />}
    >
      <ExpandableContent
        height={INVOCATION_PARAMETERS_COLLAPSED_HEIGHT_PIXELS}
        expandedBehavior="grow"
      >
        <ReadonlyJSONBlock>{invocationParameters}</ReadonlyJSONBlock>
      </ExpandableContent>
    </Card>
  );
}
