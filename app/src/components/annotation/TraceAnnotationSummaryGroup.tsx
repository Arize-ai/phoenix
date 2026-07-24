import { css } from "@emotion/react";
import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex } from "@phoenix/components";
import type { TraceAnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/TraceAnnotationSummaryGroup.graphql";
import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import { AnnotationSummaryGroupStacksRow } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { AnnotationSummaryPopover } from "@phoenix/components/annotation/AnnotationSummaryPopover";
import {
  Summary,
  SummaryValue,
  SummaryValueLabelPreview,
  SummaryValuePreview,
} from "@phoenix/pages/project/AnnotationSummary";
import type { AnnotationConfigCategorical } from "@phoenix/pages/settings/types";

const useTraceAnnotationSummaryGroup = (
  trace: TraceAnnotationSummaryGroup$key
) => {
  const data = useFragment<TraceAnnotationSummaryGroup$key>(
    graphql`
      fragment TraceAnnotationSummaryGroup on Trace {
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
    `,
    trace
  );
  const { traceAnnotations, traceAnnotationSummaries } = data;
  const sortedSummariesByName = useMemo(
    () =>
      traceAnnotationSummaries
        // Note annotations are not displayed in summary groups
        .filter((summary) => summary.name !== "note")
        .sort((a, b) => {
          return a.name.localeCompare(b.name);
        }),
    [traceAnnotationSummaries]
  );
  // newest first
  const annotationsByName = useMemo(
    () =>
      traceAnnotations.reduce<Record<string, typeof traceAnnotations>>(
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
        {}
      ),
    [traceAnnotations]
  );
  const categoricalAnnotationConfigsByName = useMemo(() => {
    return data.project.annotationConfigs.edges.reduce<
      Record<string, AnnotationConfigCategorical>
    >((acc, edge) => {
      const name = edge.node.name;
      if (name && edge.node.annotationType === "CATEGORICAL") {
        acc[name] = edge.node as AnnotationConfigCategorical;
      }
      return acc;
    }, {});
  }, [data.project.annotationConfigs]);
  return {
    sortedSummariesByName,
    annotationsByName,
    categoricalAnnotationConfigsByName,
  };
};

type TraceAnnotationSummaryGroupProps = {
  trace: TraceAnnotationSummaryGroup$key;
  showFilterActions?: boolean;
  renderEmptyState?: () => React.ReactNode;
};

const annotationLabelCSS = css`
  min-height: 20px;
  align-items: center;
  justify-content: center;
  display: flex;
`;

export const TraceAnnotationSummaryGroupTokens = ({
  trace,
  showFilterActions = false,
  renderEmptyState,
}: TraceAnnotationSummaryGroupProps) => {
  const {
    sortedSummariesByName,
    annotationsByName,
    categoricalAnnotationConfigsByName,
  } = useTraceAnnotationSummaryGroup(trace);

  if (sortedSummariesByName.length === 0 && renderEmptyState) {
    return renderEmptyState();
  }

  return (
    <Flex direction="row" gap="size-50" wrap="wrap">
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

export const TraceAnnotationSummaryGroupStacks = ({
  trace,
  renderEmptyState,
  leadingDivider = false,
}: TraceAnnotationSummaryGroupProps & { leadingDivider?: boolean }) => {
  const {
    sortedSummariesByName,
    annotationsByName,
    categoricalAnnotationConfigsByName,
  } = useTraceAnnotationSummaryGroup(trace);

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
