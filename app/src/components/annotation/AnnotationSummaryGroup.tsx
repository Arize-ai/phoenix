import { css } from "@emotion/react";
import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex } from "@phoenix/components";
import type { AnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/AnnotationSummaryGroup.graphql";
import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import { AnnotationSummaryPopover } from "@phoenix/components/annotation/AnnotationSummaryPopover";
import { Divider } from "@phoenix/components/core/layout";
import {
  Summary,
  SummaryValue,
  SummaryValueLabelPreview,
  SummaryValuePreview,
} from "@phoenix/pages/project/AnnotationSummary";
import type { AnnotationConfigCategorical } from "@phoenix/pages/settings/types";

const useAnnotationSummaryGroup = (span: AnnotationSummaryGroup$key) => {
  const data = useFragment<AnnotationSummaryGroup$key>(
    graphql`
      fragment AnnotationSummaryGroup on Span {
        project {
          id
          annotationConfigs {
            edges {
              node {
                ... on AnnotationConfigBase {
                  annotationType
                }
                ... on CategoricalAnnotationConfig {
                  id
                  name
                  optimizationDirection
                  values {
                    label
                    score
                  }
                }
              }
            }
          }
        }
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
          count
          scoreCount
          labelCount
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
          if (annotation.label == null && annotation.score == null) {
            return acc;
          }
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
  const categoricalAnnotationConfigsByName = useMemo(() => {
    return data.project.annotationConfigs.edges.reduce(
      (acc, edge) => {
        const name = edge.node.name;
        if (name && edge.node.annotationType === "CATEGORICAL") {
          acc[name] = edge.node as AnnotationConfigCategorical;
        }
        return acc;
      },
      {} as Record<string, AnnotationConfigCategorical>
    );
  }, [data.project.annotationConfigs]);
  return {
    sortedSummariesByName,
    annotationsByName,
    categoricalAnnotationConfigsByName,
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

/**
 * Lays out a row of annotation summary stacks as peer columns alongside the
 * other header metrics (status, cost, latency). An optional leading divider
 * segments this group from whatever precedes it — the trace metrics, or a
 * sibling annotation group (e.g. root span vs. trace) — without consuming the
 * vertical space a stacked section label would. The divider is owned by the
 * group so an empty group leaves no dangling separator behind.
 */
export const AnnotationSummaryGroupStacksRow = ({
  leadingDivider = false,
  children,
}: {
  leadingDivider?: boolean;
  children: React.ReactNode;
}) => (
  <Flex direction="row" gap="size-400" alignItems="stretch" flex="none">
    {leadingDivider ? <Divider orientation="vertical" /> : null}
    {children}
  </Flex>
);

export const AnnotationSummaryGroupTokens = ({
  span,
  showFilterActions = false,
  renderEmptyState,
}: AnnotationSummaryGroupProps) => {
  const {
    sortedSummariesByName,
    annotationsByName,
    categoricalAnnotationConfigsByName,
  } = useAnnotationSummaryGroup(span);

  if (sortedSummariesByName.length === 0 && renderEmptyState) {
    return renderEmptyState();
  }

  return (
    <Flex direction="row" gap="size-50" wrap="wrap" alignItems="center">
      {sortedSummariesByName.map((summary) => {
        const latestAnnotation = annotationsByName[summary.name]?.[0];
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
            >
              {meanScore != null ? (
                <SummaryValuePreview
                  name={latestAnnotation.name}
                  meanScore={meanScore}
                  size="S"
                  disableAnimation
                  annotationConfig={
                    categoricalAnnotationConfigsByName[latestAnnotation.name]
                  }
                />
              ) : (
                <SummaryValueLabelPreview
                  labelFractions={summary.labelFractions}
                />
              )}
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
  leadingDivider = false,
}: AnnotationSummaryGroupProps & { leadingDivider?: boolean }) => {
  const {
    sortedSummariesByName,
    annotationsByName,
    categoricalAnnotationConfigsByName,
  } = useAnnotationSummaryGroup(span);

  const stacks = sortedSummariesByName
    .map((summary) => {
      const latestAnnotation = annotationsByName[summary.name]?.[0];
      if (!latestAnnotation) {
        return null;
      }
      return (
        <Summary name={latestAnnotation.name} key={latestAnnotation.id}>
          <SummaryValue
            name={latestAnnotation.name}
            meanScore={summary.meanScore}
            labelFractions={summary.labelFractions}
            count={summary.count}
            scoreCount={summary.scoreCount}
            labelCount={summary.labelCount}
            annotationConfig={
              categoricalAnnotationConfigsByName[latestAnnotation.name]
            }
          />
        </Summary>
      );
    })
    .filter(Boolean);

  if (stacks.length === 0) {
    return renderEmptyState ? renderEmptyState() : null;
  }
  return (
    <AnnotationSummaryGroupStacksRow leadingDivider={leadingDivider}>
      {stacks}
    </AnnotationSummaryGroupStacksRow>
  );
};
