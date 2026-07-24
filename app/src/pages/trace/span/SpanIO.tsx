import { Flex } from "@phoenix/components";

import { SpanAttributesCard } from "./SpanAttributesCard";
import { SpanInput } from "./SpanInput";
import { SpanOutput } from "./SpanOutput";
import type { SpanIOValue } from "./types";

/**
 * The generic input / output view for spans without a kind-specific view.
 * Falls back to showing all attributes when the span has no input or output.
 */
export function SpanIO({
  input,
  output,
  attributes,
}: {
  input: SpanIOValue | null;
  output: SpanIOValue | null;
  /** The raw span attributes JSON string */
  attributes: string;
}) {
  const isMissingIO = input == null && output == null;
  return (
    <Flex direction="column" gap="size-200">
      {input && input.value != null ? <SpanInput {...input} /> : null}
      {output && output.value != null ? <SpanOutput {...output} /> : null}
      {isMissingIO ? <SpanAttributesCard attributes={attributes} /> : null}
    </Flex>
  );
}
