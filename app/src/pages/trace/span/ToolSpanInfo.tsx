import { SpanInput } from "./SpanInput";
import { SpanOutput } from "./SpanOutput";
import { ToolMetadata } from "./ToolMetadata";
import type {
  AttributeObject,
  SpanInfoData,
  SpanInfoSectionProps,
} from "./types";
import { getToolAttributes } from "./utils";

/**
 * The info view for a tool span — the tool invocation input / output and the
 * metadata describing the tool itself.
 */
export function ToolSpanInfo({
  span,
  spanAttributes,
  inputSectionProps,
  outputSectionProps,
  toolDefinitionsSectionProps,
}: {
  span: SpanInfoData;
  spanAttributes: AttributeObject;
  inputSectionProps: SpanInfoSectionProps;
  outputSectionProps: SpanInfoSectionProps;
  toolDefinitionsSectionProps: SpanInfoSectionProps;
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
    <>
      {hasInput ? <SpanInput {...input} {...inputSectionProps} /> : null}
      {hasOutput ? <SpanOutput {...output} {...outputSectionProps} /> : null}
      {hasToolAttributes ? (
        <ToolMetadata
          name={name}
          description={description}
          parameters={parameters}
          {...toolDefinitionsSectionProps}
        />
      ) : null}
    </>
  );
}
