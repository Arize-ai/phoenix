import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import type { TraceAnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/TraceAnnotationSummaryGroup.graphql";
import { AnnotationSummaryGroupStacksRow } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { AnnotationSummaryTokens } from "@phoenix/components/annotation/AnnotationSummaryTokens";
import {
  Summary,
  SummaryValue,
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
    <AnnotationSummaryTokens
      summaries={sortedSummariesByName}
      annotationsByName={annotationsByName}
      categoricalAnnotationConfigsByName={categoricalAnnotationConfigsByName}
      showFilterActions={showFilterActions}
    />
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
