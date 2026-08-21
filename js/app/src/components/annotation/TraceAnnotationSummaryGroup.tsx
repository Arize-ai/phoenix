import React from "react";
import { graphql, useFragment } from "react-relay";

import type { TraceAnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/TraceAnnotationSummaryGroup.graphql";
import { AnnotationSummaryGroupStacksRow } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import {
  AnnotationSummaryToken,
  AnnotationSummaryTokens,
} from "@phoenix/components/annotation/AnnotationSummaryTokens";
import { getTraceAnnotationTooltipFilters } from "@phoenix/pages/project/annotationFilterUtils";
import {
  Summary,
  SummaryValue,
} from "@phoenix/pages/project/AnnotationSummary";
import { AnnotationTooltipFilterActions } from "@phoenix/pages/project/AnnotationTooltipFilterActions";
import { useTraceFilters } from "@phoenix/pages/project/TraceFiltersContext";

import { groupAnnotationsByName, hasAnnotationValue } from "./annotationUtils";
import type { AnnotationOptimizationConfig } from "./optimizationUtils";
import type { Annotation } from "./types";

const useTraceAnnotationSummaryGroup = (
  trace: TraceAnnotationSummaryGroup$key
) => {
  const data = useFragment<TraceAnnotationSummaryGroup$key>(
    graphql`
      fragment TraceAnnotationSummaryGroup on Trace {
        summaryTraceAnnotations: traceAnnotations(
          filter: { exclude: { names: ["note"] } }
        ) {
          id
          name
          label
          score
          explanation
          annotatorKind
          createdAt
          updatedAt
          user {
            username
            profilePictureUrl
          }
        }
        summaryTraceAnnotationSummaries: traceAnnotationSummaries(
          filter: { exclude: { names: ["note"] } }
        ) {
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
  const { summaryTraceAnnotations, summaryTraceAnnotationSummaries } = data;
  const sortedSummariesByName = [...summaryTraceAnnotationSummaries].sort(
    (a, b) => {
      return a.name.localeCompare(b.name);
    }
  );
  const annotationsByName = groupAnnotationsByName(summaryTraceAnnotations);
  return {
    sortedSummariesByName,
    annotationsByName,
  };
};

type TraceAnnotationSummaryGroupProps = {
  trace: TraceAnnotationSummaryGroup$key;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  showFilterActions?: boolean;
  renderFilterActions?: (annotation: Annotation) => React.ReactNode;
  renderEmptyState?: () => React.ReactNode;
};

type TraceAnnotationSummaryGroupTokenProps = Omit<
  TraceAnnotationSummaryGroupProps,
  "renderEmptyState"
> & {
  annotationName: string;
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
      getFilters={getTraceAnnotationTooltipFilters}
      onAppendFilterCondition={appendFilterCondition}
    />
  );
}

export const TraceAnnotationSummaryGroupTokens = ({
  trace,
  annotationConfigsByName,
  showFilterActions = false,
  renderFilterActions,
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
      renderFilterActions={
        renderFilterActions ??
        ((annotation) => (
          <TraceAnnotationTooltipFilterActions annotation={annotation} />
        ))
      }
    />
  );
};

export const TraceAnnotationSummaryGroupToken = ({
  trace,
  annotationName,
  annotationConfigsByName,
  showFilterActions = false,
  renderFilterActions,
}: TraceAnnotationSummaryGroupTokenProps) => {
  const { sortedSummariesByName, annotationsByName } =
    useTraceAnnotationSummaryGroup(trace);
  const summary = sortedSummariesByName.find(
    (summary) => summary.name === annotationName
  );
  const annotations = annotationsByName[annotationName] ?? [];
  if (!summary || annotations.length === 0) {
    return null;
  }
  return (
    <AnnotationSummaryToken
      summary={summary}
      annotations={annotations}
      annotationConfig={annotationConfigsByName.get(annotationName)}
      showFilterActions={showFilterActions}
      renderFilterActions={
        renderFilterActions ??
        ((annotation) => (
          <TraceAnnotationTooltipFilterActions annotation={annotation} />
        ))
      }
      variant="value"
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
