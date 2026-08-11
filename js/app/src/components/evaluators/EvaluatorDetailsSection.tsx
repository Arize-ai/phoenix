import { css } from "@emotion/react";

import { Flex, Heading, Text } from "@phoenix/components";

/**
 * The bordered card wrapping each section of a read-only evaluator details
 * view, shared by the dataset and project evaluator details pages.
 */
export const evaluatorDetailsCardCSS = css`
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-size-200);
  margin-top: var(--global-dimension-size-50);
  border: 1px solid var(--global-border-color-default);
  overflow: hidden;
`;

/**
 * Read-only list of an evaluator's input mapping: which evaluator inputs map
 * to which paths on the evaluated payload, plus any fixed literal values.
 * Renders nothing when both mappings are empty.
 */
export function EvaluatorInputMappingDetails({
  inputMapping,
}: {
  inputMapping: {
    literalMapping?: Record<string, boolean | string | number> | null;
    pathMapping?: Record<string, string> | null;
  } | null;
}) {
  const literalMapping = inputMapping?.literalMapping;
  const pathMapping = inputMapping?.pathMapping;

  const hasLiteralMapping =
    literalMapping && Object.keys(literalMapping).length > 0;
  const hasPathMapping = pathMapping && Object.keys(pathMapping).length > 0;

  if (!hasLiteralMapping && !hasPathMapping) {
    return null;
  }

  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>Input Mapping</Heading>
      <div css={evaluatorDetailsCardCSS}>
        <Flex direction="column" gap="size-100">
          {pathMapping &&
            Object.entries(pathMapping).map(([key, value]) => (
              <Text key={key} size="S">
                <Text weight="heavy">{key}:</Text> {value || "Not mapped"}
              </Text>
            ))}
          {literalMapping &&
            Object.entries(literalMapping).map(([key, value]) => (
              <Text key={key} size="S">
                <Text weight="heavy">{key}:</Text>{" "}
                {typeof value === "boolean"
                  ? value
                    ? "Yes"
                    : "No"
                  : String(value)}
              </Text>
            ))}
        </Flex>
      </div>
    </Flex>
  );
}
