import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";

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

const statTileCSS = css`
  flex: 1 1 0;
  min-width: 0;
  border-radius: var(--global-rounding-medium);
  border: 1px solid var(--global-border-color-default);
  padding: var(--global-dimension-size-200);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);

  .evaluator-stat-tile__label {
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .evaluator-stat-tile__value {
    font-size: var(--global-font-size-xl);
    line-height: var(--global-line-height-xl);
    font-weight: var(--font-weight-heavy);
  }
  .evaluator-stat-tile__value[data-tone="danger"] {
    color: var(--global-color-danger);
  }
`;

const statRowCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-size-200);

  /* One headline number per line rather than four unreadable slivers. */
  @container (max-width: 800px) {
    flex-wrap: wrap;
    > * {
      flex-basis: calc(50% - var(--global-dimension-size-100));
    }
  }
`;

/** A row of headline numbers, sized so each tile shares the width evenly. */
export function EvaluatorStatRow({ children }: PropsWithChildren) {
  return <div css={statRowCSS}>{children}</div>;
}

/**
 * One headline number: what it measures, the value, and the context needed to
 * read it. `tone="danger"` is for a count that is bad by definition, so a
 * nonzero failure count is legible without reading the label.
 */
export function EvaluatorStatTile({
  label,
  value,
  caption,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div css={statTileCSS}>
      <Text size="XS" color="text-700" className="evaluator-stat-tile__label">
        {label}
      </Text>
      <div className="evaluator-stat-tile__value" data-tone={tone}>
        {value}
      </div>
      {caption == null ? null : (
        <Text size="XS" color="text-700">
          {caption}
        </Text>
      )}
    </div>
  );
}

const detailListCSS = css`
  display: grid;
  /* The label column takes what it needs; the value column absorbs the rest so
     values line up on their right edge and scan as a column. */
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--global-dimension-size-150) var(--global-dimension-size-200);
  margin: 0;

  dt {
    margin: 0;
  }
  dd {
    margin: 0;
    justify-self: end;
    text-align: end;
    min-width: 0;
  }
`;

/** The label/value body of a configuration card, as a definition list. */
export function EvaluatorDetailList({ children }: PropsWithChildren) {
  return <dl css={detailListCSS}>{children}</dl>;
}

/** One labelled value. Values are right-aligned so the column reads cleanly. */
export function EvaluatorDetailRow({
  label,
  children,
}: PropsWithChildren<{ label: string }>) {
  return (
    <>
      <dt>
        <Text size="S" color="text-700">
          {label}
        </Text>
      </dt>
      <dd>{children}</dd>
    </>
  );
}
