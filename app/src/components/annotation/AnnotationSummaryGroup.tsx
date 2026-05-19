import { css } from "@emotion/react";
import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex } from "@phoenix/components";
import type {
  AnnotationSummaryGroup$data,
  AnnotationSummaryGroup$key,
} from "@phoenix/components/annotation/__generated__/AnnotationSummaryGroup.graphql";
import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import { AnnotationSummaryPopover } from "@phoenix/components/annotation/AnnotationSummaryPopover";
import {
  Summary,
  SummaryValue,
  SummaryValueLabelPreview,
  SummaryValuePreview,
} from "@phoenix/pages/project/AnnotationSummary";
import type { AnnotationConfigCategorical } from "@phoenix/pages/settings/types";

type AnnotationSummaryGroupTrace = NonNullable<
  AnnotationSummaryGroup$data["trace"]
>;
type AnnotationSummaryGroupAnnotationList =
  | AnnotationSummaryGroup$data["spanAnnotations"]
  | AnnotationSummaryGroupTrace["traceAnnotations"];
type AnnotationSummaryGroupAnnotation =
  AnnotationSummaryGroupAnnotationList[number];
type AnnotationSummaryGroupSummaryList =
  | AnnotationSummaryGroup$data["spanAnnotationSummaries"]
  | AnnotationSummaryGroupTrace["traceAnnotationSummaries"];
type AnnotationSummaryGroupSummary = AnnotationSummaryGroupSummaryList[number];

const useAnnotationSummaryGroup = (
  span: AnnotationSummaryGroup$key,
  {
    includeTraceAnnotations = false,
  }: {
    includeTraceAnnotations?: boolean;
  } = {}
) => {
  const data = useFragment<AnnotationSummaryGroup$key>(
    graphql`
      fragment AnnotationSummaryGroup on Span
      @argumentDefinitions(
        includeTraceAnnotations: { type: "Boolean!", defaultValue: false }
      ) {
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
        trace @include(if: $includeTraceAnnotations) {
          traceAnnotations {
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
          traceAnnotationSummaries {
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
  const trace = includeTraceAnnotations ? data.trace : null;
  const sortSummaries = (
    summaries: AnnotationSummaryGroupSummaryList
  ): AnnotationSummaryGroupSummary[] =>
    [...summaries]
      // Note annotations are not displayed in summary groups
      .filter((summary) => summary.name !== "note")
      .sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
  const groupAnnotationsByName = (
    annotations: AnnotationSummaryGroupAnnotationList
  ) =>
    annotations.reduce(
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
      {} as Record<string, AnnotationSummaryGroupAnnotation[]>
    );
  const spanAnnotationsByName = useMemo(
    () => groupAnnotationsByName(spanAnnotations),
    [spanAnnotations]
  );
  const traceAnnotationsByName = useMemo(
    () => groupAnnotationsByName(trace?.traceAnnotations ?? []),
    [trace?.traceAnnotations]
  );
  const summaryGroups = useMemo(
    () => [
      ...(trace
        ? sortSummaries(trace.traceAnnotationSummaries).map((summary) => ({
            key: `trace:${summary.name}`,
            summary,
            annotations: traceAnnotationsByName[summary.name] ?? [],
          }))
        : []),
      ...sortSummaries(spanAnnotationSummaries).map((summary) => ({
        key: `span:${summary.name}`,
        summary,
        annotations: spanAnnotationsByName[summary.name] ?? [],
      })),
    ],
    [
      spanAnnotationSummaries,
      spanAnnotationsByName,
      trace,
      traceAnnotationsByName,
    ]
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
    summaryGroups,
    categoricalAnnotationConfigsByName,
  };
};

type AnnotationSummaryGroupProps = {
  span: AnnotationSummaryGroup$key;
  showFilterActions?: boolean;
  renderEmptyState?: () => React.ReactNode;
  includeTraceAnnotations?: boolean;
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
  includeTraceAnnotations = false,
}: AnnotationSummaryGroupProps) => {
  const { summaryGroups, categoricalAnnotationConfigsByName } =
    useAnnotationSummaryGroup(span, { includeTraceAnnotations });

  if (summaryGroups.length === 0 && renderEmptyState) {
    return renderEmptyState();
  }

  return (
    <Flex direction="row" gap="size-50" wrap="wrap">
      {summaryGroups.map(({ key, summary, annotations }) => {
        const latestAnnotation = annotations[0];
        const meanScore = summary?.meanScore;
        if (!latestAnnotation) {
          return null;
        }
        return (
          <AnnotationSummaryPopover
            key={key}
            annotations={annotations}
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
  includeTraceAnnotations = false,
}: AnnotationSummaryGroupProps) => {
  const { summaryGroups, categoricalAnnotationConfigsByName } =
    useAnnotationSummaryGroup(span, { includeTraceAnnotations });

  if (summaryGroups.length === 0 && renderEmptyState) {
    return renderEmptyState();
  }

  return (
    <Flex direction="row" gap="size-400" wrap={includeTraceAnnotations}>
      {summaryGroups.map(({ key, summary, annotations }) => {
        const latestAnnotation = annotations[0];
        if (!latestAnnotation) {
          return null;
        }
        return (
          <Summary name={latestAnnotation.name} key={key}>
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
      })}
    </Flex>
  );
};
