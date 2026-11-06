import { css } from "@emotion/react";

import { Flex, List, ListItem, Text } from "@phoenix/components";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import {
  getOptimizationBounds,
  getOptimizationValue,
} from "@phoenix/components/annotation/optimizationUtils";
import type { EvaluatorOptimizationDirection } from "@phoenix/types";

const annotationValueListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);

  && li {
    padding: 0;
  }

  && li:not(:first-of-type)::after {
    content: none;
  }
`;

/**
 * The labels a categorical annotation can take, one per row, each with its
 * score tinted by whether it is good or bad under the optimization direction.
 * Shared by the evaluator gallery and the evaluator details pages so a
 * categorical annotation reads the same everywhere.
 */
export function AnnotationValueList({
  values,
  optimizationDirection,
}: {
  values: ReadonlyArray<{
    readonly label?: string | null;
    readonly score?: number | null;
  }>;
  optimizationDirection: EvaluatorOptimizationDirection;
}) {
  const scoredValues = values.map(({ label, score }) => ({
    label: label ?? "",
    score: score ?? null,
  }));
  const optimizationBounds = getOptimizationBounds({
    annotationType: "CATEGORICAL",
    optimizationDirection,
    values: scoredValues,
  });
  return (
    <List size="S" css={annotationValueListCSS}>
      {scoredValues.map(({ label, score }, idx) => (
        <ListItem key={label || idx}>
          <Flex
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap="size-100"
          >
            <Text size="S">{label}</Text>
            {/* Untinted scores (no direction, or no score) fall back to the
                muted color of the wrapper. */}
            <Text size="XS" color="text-500">
              <AnnotationScoreText
                elementType="span"
                fontFamily="mono"
                size="XS"
                optimizationValue={getOptimizationValue({
                  score,
                  ...optimizationBounds,
                })}
              >
                {score ?? "—"}
              </AnnotationScoreText>
            </Text>
          </Flex>
        </ListItem>
      ))}
    </List>
  );
}
