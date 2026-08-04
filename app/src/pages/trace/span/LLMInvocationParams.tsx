import {
  Card,
  CardCollapsedPreview,
  CopyToClipboardButton,
} from "@phoenix/components";
import { toRecordPreview } from "@phoenix/utils/contentPreviewUtils";

import { ReadonlyJSONBlock } from "../ReadonlyJSONBlock";
import { defaultCardProps } from "./constants";

/**
 * A collapsed card displaying the invocation parameters of an LLM span as a
 * read-only JSON block. Rendered at the top of the input messages so it does
 * not need its own tab.
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
      defaultOpen={false}
      title="Invocation Params"
      headerContent={
        <CardCollapsedPreview>
          {toRecordPreview(invocationParameters)}
        </CardCollapsedPreview>
      }
      extra={<CopyToClipboardButton text={invocationParameters} />}
    >
      <ReadonlyJSONBlock>{invocationParameters}</ReadonlyJSONBlock>
    </Card>
  );
}
