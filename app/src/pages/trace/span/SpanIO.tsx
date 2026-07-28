import { Flex } from "@phoenix/components";

import { SpanInput } from "./SpanInput";
import { SpanOutput } from "./SpanOutput";
import type { SpanIOValue } from "./types";

/**
 * The generic input / output view for spans without a kind-specific view.
 *
 * Renders nothing when the span has neither. The flat details view renders
 * attributes in its own section.
 */
export function SpanIO({
  input,
  output,
}: {
  input: SpanIOValue | null;
  output: SpanIOValue | null;
}) {
  return (
    <Flex direction="column" gap="size-200">
      {input && input.value != null ? <SpanInput {...input} /> : null}
      {output && output.value != null ? <SpanOutput {...output} /> : null}
    </Flex>
  );
}
