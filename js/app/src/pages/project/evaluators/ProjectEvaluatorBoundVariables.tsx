import { css } from "@emotion/react";

import { Flex, Heading, Text } from "@phoenix/components";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { getEvaluatorBoundVariables } from "@phoenix/pages/project/evaluators/evaluatorBoundVariables";
import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { toContentPreview } from "@phoenix/utils/contentPreviewUtils";

const GRAIN_NOUN: Record<ProjectEvaluatorMappingSourceGrain, string> = {
  span: "span",
  session: "session",
};

/**
 * The values a record offers to an evaluator by name alone.
 *
 * Writing `{{latency_ms}}` in a prompt, or `def evaluate(latency_ms)` in code,
 * reads the value shown here — no mapping row needed. These are the same names
 * a filter condition uses to pick records, so one vocabulary covers both.
 */
export const ProjectEvaluatorBoundVariables = ({
  grain,
  showHeading = true,
}: {
  grain: ProjectEvaluatorMappingSourceGrain;
  showHeading?: boolean;
}) => {
  const values = useEvaluatorStore((state) => state.evaluatorBoundVariables);
  const variables = getEvaluatorBoundVariables(grain);
  const hasValues = Object.keys(values).length > 0;
  return (
    <Flex direction="column" gap="size-100">
      {showHeading ? (
        <Flex direction="column" gap="size-25">
          <Heading level={3} weight="heavy">
            Available from the {GRAIN_NOUN[grain]}
          </Heading>
          <Text color="text-500" size="S">
            Use any of these names directly in your prompt or code. No mapping
            required.
          </Text>
        </Flex>
      ) : null}
      <dl css={boundVariablesCSS}>
        {variables.map(({ name, type, description }) => {
          const preview = hasValues
            ? toContentPreview(values[name], { maxLength: 64 })
            : undefined;
          return (
            <div className="bound-variables__row" key={name}>
              <dt className="bound-variables__name" title={description}>
                {name}
              </dt>
              <dd className="bound-variables__value">
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
          Values appear once you select a {GRAIN_NOUN[grain]} to test against.
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
