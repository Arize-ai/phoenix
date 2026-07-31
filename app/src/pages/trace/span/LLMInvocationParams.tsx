import { Card, CopyToClipboardButton } from "@phoenix/components";

import { ReadonlyJSONBlock } from "../ReadonlyJSONBlock";
import { defaultCardProps } from "./constants";
import { ExpandableSpanContent } from "./ExpandableSpanContent";

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
      extra={<CopyToClipboardButton text={invocationParameters} />}
    >
      <ExpandableSpanContent>
        <ReadonlyJSONBlock>{invocationParameters}</ReadonlyJSONBlock>
      </ExpandableSpanContent>
    </Card>
  );
}
