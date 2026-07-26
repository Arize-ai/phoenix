import { Flex } from "@phoenix/components";

import { SpanInput } from "./SpanInput";
import { SpanOutput } from "./SpanOutput";
import type { SpanIOValue } from "./types";

/**
 * The generic input / output view for spans without a kind-specific view.
 *
 * Renders nothing when the span has neither, rather than falling back to the
 * attributes: `SpanInfo` now appends the attributes card below every span, so
 * a fallback here would show the same card twice.
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
