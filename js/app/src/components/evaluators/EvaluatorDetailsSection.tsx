import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";

import { Flex, Heading, List, ListItem, Text } from "@phoenix/components";

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
 * The evaluator overview split: content on the left, configuration cards in
 * the aside on the right, collapsing to one column when the container narrows.
 * The grid queries its nearest size container, so wrap it in
 * `evaluatorSplitContainerCSS` (or another `container-type: inline-size`
 * ancestor).
 */
export const evaluatorSplitContainerCSS = css`
  container-type: inline-size;
`;

export const evaluatorSplitLayoutCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(300px, 24vw, 380px);
  gap: var(--global-dimension-size-200);
  align-items: start;

  @container (max-width: 1000px) {
    grid-template-columns: minmax(0, 1fr);
  }
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

/** The label/value body of a configuration card. */
export function EvaluatorDetailList({ children }: PropsWithChildren) {
  return <List size="M">{children}</List>;
}

/**
 * One labelled value in a configuration card. A string label or value gets
 * the standard text treatment; nodes pass through for richer content.
 */
export function EvaluatorDetailRow({
  label,
  labelExtra,
  children,
}: PropsWithChildren<{ label: ReactNode; labelExtra?: ReactNode }>) {
  return (
    <ListItem>
      <Flex
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap="size-200"
      >
        <Flex direction="row" alignItems="center" gap="size-50" flexShrink={0}>
          {typeof label === "string" ? (
            <Text size="S" color="text-700">
              {label}
            </Text>
          ) : (
            label
          )}
          {labelExtra}
        </Flex>
        <Flex
          direction="row"
          alignItems="center"
          justifyContent="end"
          gap="size-100"
          minWidth={0}
        >
          {typeof children === "string" ? (
            <Text size="S">{children}</Text>
          ) : (
            children
          )}
        </Flex>
      </Flex>
    </ListItem>
  );
}
