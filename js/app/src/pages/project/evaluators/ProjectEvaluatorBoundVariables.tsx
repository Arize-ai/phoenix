import { css } from "@emotion/react";

import { Flex, Heading, Text } from "@phoenix/components";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { getEvaluatorBoundVariables } from "@phoenix/pages/project/evaluators/evaluatorBoundVariables";
import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { toContentPreview } from "@phoenix/utils/contentPreviewUtils";

const GRAIN_NOUN: Record<ProjectEvaluatorMappingSourceGrain, string> = {
  span: "span",
  session: "session",
};

/** Digits a rounded number keeps before the rest moves to the hover title. */
const DISPLAY_SIGNIFICANT_DIGITS = 4;

/**
 * What a bound value reads as in the list, plus the exact value to hover for
 * when rounding hid something.
 *
 * A cost arrives with more decimals than a row this narrow can be read at, so
 * the row is rounded and the full number stays one hover away. Whole numbers
 * and everything that is not a number are already exact.
 */
export function toBoundValueDisplay(value: unknown): {
  text: string | undefined;
  exact?: string;
} {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    !Number.isInteger(value)
  ) {
    const rounded = Number(value.toPrecision(DISPLAY_SIGNIFICANT_DIGITS));
    return {
      text: String(rounded),
      exact: rounded === value ? undefined : String(value),
    };
  }
  return { text: toContentPreview(value, { maxLength: 64 }) };
}

/**
 * The values a record offers under `metadata`.
 *
 * Writing `{{metadata.latency_ms}}` in a prompt, or reading
 * `metadata["latency_ms"]` in code, reads the value shown here. These are the
 * same names a filter condition uses to pick records, so one vocabulary covers
 * both.
 */
export const ProjectEvaluatorBoundVariables = ({
  grain,
  showHeading = true,
}: {
  grain: ProjectEvaluatorMappingSourceGrain;
  showHeading?: boolean;
}) => {
  const metadata = useEvaluatorStore((state) =>
    state.evaluatorMappingSource.grain === grain
      ? state.evaluatorMappingSource.source.metadata
      : undefined
  );
  const values = isStringKeyedObject(metadata) ? metadata : {};
  const variables = getEvaluatorBoundVariables(grain);
  const hasValues = variables.some(({ name }) => values[name] != null);
  return (
    <Flex direction="column" gap="size-100">
      {showHeading ? (
        <Flex direction="column" gap="size-25">
          <Heading level={3} weight="heavy">
            Available from the {GRAIN_NOUN[grain]}
          </Heading>
          <Text color="text-500" size="S">
            Use these names in your prompt or code.
          </Text>
        </Flex>
      ) : null}
      <dl css={boundVariablesCSS}>
        {variables.map(({ name, type, description }) => {
          const display = hasValues
            ? toBoundValueDisplay(values[name])
            : undefined;
          const preview = display?.text;
          return (
            <div className="bound-variables__row" key={name}>
              <dt className="bound-variables__name" title={description}>
                {name}
              </dt>
              <dd className="bound-variables__value" title={display?.exact}>
                {preview ?? (
                  // Before a record is picked there is nothing to show but the
                  // kind of value; once one is picked, an empty cell means the
                  // record genuinely has no value there.
                  <span className="bound-variables__type">
                    {hasValues ? "—" : type}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {hasValues ? null : (
        <Text size="S" color="text-500">
          Select a {GRAIN_NOUN[grain]} to see values.
        </Text>
      )}
    </Flex>
  );
};

const boundVariablesCSS = css`
  margin: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--global-dimension-size-10);

  .bound-variables__row {
    display: flex;
    align-items: baseline;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-25) var(--global-dimension-size-75);
    border-radius: var(--global-rounding-small);
    &:nth-of-type(odd) {
      background-color: rgba(var(--global-color-gray-500-rgb), 0.08);
    }
  }
  .bound-variables__name {
    flex: none;
    font-family: var(--global-font-family-mono);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-900);
  }
  .bound-variables__value {
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-700);
  }
  .bound-variables__type {
    font-size: var(--global-font-size-xxs);
    color: var(--global-text-color-500);
  }
`;
