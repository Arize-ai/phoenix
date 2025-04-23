import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import { AnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/AnnotationSummaryGroup.graphql";
import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import { AnnotationTooltip } from "@phoenix/components/annotation/AnnotationTooltip";
import {
  Summary,
  SummaryValue,
} from "@phoenix/pages/project/AnnotationSummary";
import { AnnotationTooltipFilterActions } from "@phoenix/pages/project/AnnotationTooltipFilterActions";

const annotationLabelCSS = css`
  min-height: 20px;
  align-items: center;
  justify-content: center;
  display: flex;
`;

export const AnnotationSummaryGroup = ({
  span,
  showFilterActions = false,
  renderEmptyState,
  variant = "pills",
}: {
  span: AnnotationSummaryGroup$key;
  showFilterActions?: boolean;
  renderEmptyState?: () => React.ReactNode;
  variant?: "stacked" | "pills";
}) => {
  const data = useFragment<AnnotationSummaryGroup$key>(
    graphql`
      fragment AnnotationSummaryGroup on Span {
        spanAnnotations {
          id
          name
          label
          score
          annotatorKind
          createdAt
        }
        spanAnnotationSummaries {
          labelFractions {
            fraction
            label
          }
          meanScore
          name
        }
      }
    `,
    span
  );
  const { spanAnnotations, spanAnnotationSummaries } = data;
  const sortedSummariesByName = useMemo(
    () =>
      spanAnnotationSummaries.slice().sort((a, b) => {
        return a.name.localeCompare(b.name);
      }),
    [spanAnnotationSummaries]
  );
  const sortedAnnotationsByCreatedAt = useMemo(
    () =>
      spanAnnotations.slice().sort((a, b) => {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }),
    [spanAnnotations]
  );
  if (spanAnnotationSummaries.length === 0 && renderEmptyState) {
    return renderEmptyState();
  }
  // TODO: how do we want to render annotations that don't have a score?
  // We can display a count per name, display nothing, display all labels of the annotation on hover, etc
  if (variant === "stacked") {
    return (
      <Flex direction="row" gap="size-200">
        {sortedSummariesByName.map((summary) => {
          const latestAnnotation = sortedAnnotationsByCreatedAt.find(
            (annotation) => annotation.name === summary.name
          );
          if (!latestAnnotation) {
            return null;
          }
          return (
            <AnnotationTooltip
              key={latestAnnotation.id}
              leadingExtra={<Text weight="heavy">Latest annotation</Text>}
              annotation={latestAnnotation}
            >
              <Summary name={latestAnnotation.name}>
                <SummaryValue
                  name={latestAnnotation.name}
                  meanScore={summary.meanScore}
                  labelFractions={summary.labelFractions}
                />
              </Summary>
            </AnnotationTooltip>
          );
        })}
      </Flex>
    );
  }
  return (
    <Flex direction="row" gap="size-50" wrap="wrap">
      {sortedSummariesByName.map((summary) => {
        const latestAnnotation = sortedAnnotationsByCreatedAt.find(
          (annotation) => annotation.name === summary.name
        );
        const labelFractions = summary?.labelFractions;
        const meanScore = summary?.meanScore;
        if (!latestAnnotation) {
          return null;
        }
        return (
          <AnnotationTooltip
            key={latestAnnotation.id}
            annotation={latestAnnotation}
            layout="horizontal"
            width="500px"
            leadingExtra={<Text weight="heavy">Latest annotation</Text>}
            extra={
              showFilterActions ? (
                <AnnotationTooltipFilterActions annotation={latestAnnotation} />
              ) : null
            }
          >
            <AnnotationLabel
              annotation={latestAnnotation}
              annotationDisplayPreference="none"
              css={annotationLabelCSS}
            >
              {meanScore ? (
                <SummaryValue
                  name={latestAnnotation.name}
                  labelFractions={labelFractions}
                  meanScore={meanScore}
                  size="S"
                />
              ) : null}
            </AnnotationLabel>
          </AnnotationTooltip>
        );
      })}
    </Flex>
  );
};
