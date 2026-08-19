import { Flex } from "@phoenix/components";

import { SpanInput } from "./SpanInput";
import { SpanOutput } from "./SpanOutput";
import { ToolMetadata } from "./ToolMetadata";
import type { AttributeObject, SpanInfoData } from "./types";
import { getToolAttributes } from "./utils";

/**
 * The info view for a tool span — the tool invocation input / output and the
 * metadata describing the tool itself.
 */
export function ToolSpanInfo({
  span,
  spanAttributes,
}: {
  span: SpanInfoData;
  spanAttributes: AttributeObject;
}) {
  const { input, output } = span;
  const hasInput = typeof input?.value === "string";
  const hasOutput = typeof output?.value === "string";
  const { hasToolAttributes, name, description, parameters } =
    getToolAttributes(spanAttributes);
  if (!hasInput && !hasOutput && !hasToolAttributes) {
    return null;
  }
  return (
    <Flex direction="column" gap="size-200">
      {hasInput ? <SpanInput {...input} /> : null}
      {hasOutput ? <SpanOutput {...output} /> : null}
      {hasToolAttributes ? (
        <ToolMetadata
          name={name}
          description={description}
          parameters={parameters}
        />
      ) : null}
    </Flex>
  );
}
