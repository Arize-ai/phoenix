import { SpanInput } from "./SpanInput";
import { SpanOutput } from "./SpanOutput";
import type { SpanInfoSectionProps, SpanIOValue } from "./types";

/**
 * The generic input / output view for spans without a kind-specific view.
 *
 * Renders nothing when the span has neither. The flat details view renders
 * attributes in its own section.
 */
export function SpanIO({
  input,
  output,
  inputSectionProps,
  outputSectionProps,
}: {
  input: SpanIOValue | null;
  output: SpanIOValue | null;
  inputSectionProps: SpanInfoSectionProps;
  outputSectionProps: SpanInfoSectionProps;
}) {
  return (
    <>
      {input && input.value != null ? (
        <SpanInput {...input} {...inputSectionProps} />
      ) : null}
      {output && output.value != null ? (
        <SpanOutput {...output} {...outputSectionProps} />
      ) : null}
    </>
  );
}
