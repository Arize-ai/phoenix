import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import { AnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/AnnotationSummaryGroup.graphql";
import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import { AnnotationSummaryPopover } from "@phoenix/components/annotation/AnnotationSummaryPopover";
import { AnnotationTooltip } from "@phoenix/components/annotation/AnnotationTooltip";
import {
  Summary,
  SummaryValue,
  SummaryValuePreview,
} from "@phoenix/pages/project/AnnotationSummary";

const useAnnotationSummaryGroup = (span: AnnotationSummaryGroup$key) => {
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
          user {
            username
            profilePictureUrl
          }
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
      spanAnnotationSummaries
        // Note annotations are not displayed in summary groups
        .filter((summary) => summary.name !== "note")
        .sort((a, b) => {
          return a.name.localeCompare(b.name);
        }),
    [spanAnnotationSummaries]
  );
  // newest first
  const annotationsByName = useMemo(
    () =>
      spanAnnotations.reduce(
        (acc, annotation) => {
          if (!acc[annotation.name]) {
            acc[annotation.name] = [annotation];
          } else {
            acc[annotation.name] = [annotation, ...acc[annotation.name]].sort(
              (a, b) => {
                return (
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
                );
              }
            );
          }
          return acc;
        },
        {} as Record<string, typeof spanAnnotations>
      ),
    [spanAnnotations]
  );
  return {
    sortedSummariesByName,
    annotationsByName,
  };
};

type AnnotationSummaryGroupProps = {
  span: AnnotationSummaryGroup$key;
  showFilterActions?: boolean;
  renderEmptyState?: () => React.ReactNode;
};

const annotationLabelCSS = css`
  min-height: 20px;
  align-items: center;
  justify-content: center;
  display: flex;
`;

export const AnnotationSummaryGroupTokens = ({
  span,
  showFilterActions = false,
  renderEmptyState,
}: AnnotationSummaryGroupProps) => {
  const { sortedSummariesByName, annotationsByName } =
    useAnnotationSummaryGroup(span);

  if (sortedSummariesByName.length === 0 && renderEmptyState) {
    return renderEmptyState();
  }

  return (
    <Flex direction="row" gap="size-50" wrap="wrap">
      {sortedSummariesByName.map((summary) => {
        const latestAnnotation = annotationsByName[summary.name][0];
        const meanScore = summary?.meanScore;
        if (!latestAnnotation) {
          return null;
        }
        return (
          <AnnotationSummaryPopover
            key={latestAnnotation.id}
            annotations={annotationsByName[summary.name]}
            width="500px"
            meanScore={meanScore}
            showFilterActions={showFilterActions}
          >
            <AnnotationLabel
              annotation={latestAnnotation}
              annotationDisplayPreference="none"
              css={annotationLabelCSS}
              clickable
              showClickableIcon={false}
            >
              {meanScore ? (
                <SummaryValuePreview
                  name={latestAnnotation.name}
                  meanScore={meanScore}
                  size="S"
                  disableAnimation
                />
              ) : null}
            </AnnotationLabel>
          </AnnotationSummaryPopover>
        );
      })}
    </Flex>
  );
};

export const AnnotationSummaryGroupStacks = ({
  span,
  renderEmptyState,
}: AnnotationSummaryGroupProps) => {
  const { sortedSummariesByName, annotationsByName } =
    useAnnotationSummaryGroup(span);

  if (sortedSummariesByName.length === 0 && renderEmptyState) {
    return renderEmptyState();
  }
  // TODO: how do we want to render annotations that don't have a score?
  // We can display a count per name, display nothing, display all labels of the annotation on hover, etc
  return (
    <Flex direction="row" gap="size-400">
      {sortedSummariesByName.map((summary) => {
        const latestAnnotation = annotationsByName[summary.name][0];
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
};
