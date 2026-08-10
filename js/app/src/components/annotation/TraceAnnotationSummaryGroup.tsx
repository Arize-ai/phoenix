import React from "react";
import { graphql, useFragment } from "react-relay";

import type { TraceAnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/TraceAnnotationSummaryGroup.graphql";
import { AnnotationSummaryGroupStacksRow } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { AnnotationSummaryTokens } from "@phoenix/components/annotation/AnnotationSummaryTokens";
import {
  Summary,
  SummaryValue,
} from "@phoenix/pages/project/AnnotationSummary";
import { AnnotationTooltipFilterActions } from "@phoenix/pages/project/AnnotationTooltipFilterActions";
import { useTraceFilters } from "@phoenix/pages/project/TraceFiltersContext";

import { hasAnnotationValue } from "./annotationUtils";
import type { AnnotationOptimizationConfig } from "./optimizationUtils";

const useTraceAnnotationSummaryGroup = (
  trace: TraceAnnotationSummaryGroup$key
) => {
  const data = useFragment<TraceAnnotationSummaryGroup$key>(
    graphql`
      fragment TraceAnnotationSummaryGroup on Trace {
        traceAnnotations {
          id
          name
          label
          score
          explanation
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
  const sortedSummariesByName = traceAnnotationSummaries
    // Note annotations are not displayed in summary groups
    .filter((summary) => summary.name !== "note")
    .sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
  // newest first
  const annotationsByName = traceAnnotations.reduce<
    Partial<Record<string, typeof traceAnnotations>>
  >((acc, annotation) => {
    const annotationsForName = acc[annotation.name];
    if (annotationsForName == null) {
      acc[annotation.name] = [annotation];
    } else {
      acc[annotation.name] = [annotation, ...annotationsForName].sort(
        (a, b) => {
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
      );
    }
    return acc;
  }, {});
  return {
    sortedSummariesByName,
    annotationsByName,
  };
};

type TraceAnnotationSummaryGroupProps = {
  trace: TraceAnnotationSummaryGroup$key;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  showFilterActions?: boolean;
  renderEmptyState?: () => React.ReactNode;
};

function TraceAnnotationTooltipFilterActions({
  annotation,
}: {
  annotation: {
    name: string;
    label?: string | null;
    score?: number | null;
  };
}) {
  const { appendFilterCondition } = useTraceFilters();
  return (
    <AnnotationTooltipFilterActions
      annotation={annotation}
      onAppendFilterCondition={appendFilterCondition}
    />
  );
}

export const TraceAnnotationSummaryGroupTokens = ({
  trace,
  annotationConfigsByName,
  showFilterActions = false,
  renderEmptyState,
}: TraceAnnotationSummaryGroupProps) => {
  const { sortedSummariesByName, annotationsByName } =
    useTraceAnnotationSummaryGroup(trace);

  const summariesWithTokens = sortedSummariesByName.filter(
    (summary) =>
      annotationsByName[summary.name]?.some(hasAnnotationValue) === true
  );

  if (summariesWithTokens.length === 0 && renderEmptyState) {
    return renderEmptyState();
  }

  return (
    <AnnotationSummaryTokens
      summaries={summariesWithTokens}
      annotationsByName={annotationsByName}
      annotationConfigsByName={annotationConfigsByName}
      showFilterActions={showFilterActions}
      renderFilterActions={(annotation) => (
        <TraceAnnotationTooltipFilterActions annotation={annotation} />
      )}
    />
  );
};

export const TraceAnnotationSummaryGroupStacks = ({
  trace,
  annotationConfigsByName,
  renderEmptyState,
  leadingDivider = false,
}: TraceAnnotationSummaryGroupProps & { leadingDivider?: boolean }) => {
  const { sortedSummariesByName, annotationsByName } =
    useTraceAnnotationSummaryGroup(trace);

  const stacks = sortedSummariesByName
    .map((summary) => {
      const latestAnnotation =
        annotationsByName[summary.name]?.find(hasAnnotationValue);
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
            annotationConfig={annotationConfigsByName.get(
              latestAnnotation.name
            )}
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
