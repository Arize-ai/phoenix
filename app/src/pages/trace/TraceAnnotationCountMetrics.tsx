import { css } from "@emotion/react";
import { graphql, useFragment } from "react-relay";

import { Flex, Icon, Icons, Text } from "@phoenix/components";
import type { TraceAnnotationCountMetrics_span$key } from "@phoenix/pages/trace/__generated__/TraceAnnotationCountMetrics_span.graphql";
import { formatNumber } from "@phoenix/utils/numberFormatUtils";

type AnnotationNameRecord = {
  readonly name: string;
};

export function getAnnotationMetricCount({
  spanAnnotations,
  traceAnnotations,
}: {
  spanAnnotations: ReadonlyArray<AnnotationNameRecord>;
  traceAnnotations: ReadonlyArray<AnnotationNameRecord>;
}) {
  return [...spanAnnotations, ...traceAnnotations].filter(
    (annotation) => annotation.name !== "note"
  ).length;
}

function TraceAnnotationCountMetric({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  return (
    <span css={traceAnnotationCountMetricCSS}>
      <Icon svg={<Icons.Scale />} />
      <Text size="S" fontFamily="mono">
        {formatNumber(count)}
      </Text>
    </span>
  );
}

export function TraceAnnotationCountMetrics({
  span,
}: {
  span: TraceAnnotationCountMetrics_span$key;
}) {
  const data = useFragment<TraceAnnotationCountMetrics_span$key>(
    graphql`
      fragment TraceAnnotationCountMetrics_span on Span {
        spanAnnotations {
          name
        }
        trace {
          traceAnnotations {
            name
          }
        }
      }
    `,
    span
  );
  const annotationCount = getAnnotationMetricCount({
    spanAnnotations: data.spanAnnotations,
    traceAnnotations: data.trace.traceAnnotations,
  });

  if (annotationCount === 0) {
    return null;
  }

  return (
    <Flex direction="row" gap="size-100" alignItems="center" wrap>
      <TraceAnnotationCountMetric count={annotationCount} />
    </Flex>
  );
}

const traceAnnotationCountMetricCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-static-size-50);
  align-items: center;
  color: var(--global-text-color-900);
  font-size: var(--global-font-size-s);
`;
