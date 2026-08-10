import React from "react";
import { graphql, useFragment } from "react-relay";

import type { SessionAnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/SessionAnnotationSummaryGroup.graphql";
import { AnnotationSummaryGroupStacksRow } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { AnnotationSummaryTokens } from "@phoenix/components/annotation/AnnotationSummaryTokens";
import {
  Summary,
  SummaryValue,
} from "@phoenix/pages/project/AnnotationSummary";
import { AnnotationTooltipFilterActions } from "@phoenix/pages/project/AnnotationTooltipFilterActions";
import { useSessionFilters } from "@phoenix/pages/project/SessionFiltersContext";

import { hasAnnotationValue } from "./annotationUtils";
import type { AnnotationOptimizationConfig } from "./optimizationUtils";

const useSessionAnnotationSummaryGroup = (
  session: SessionAnnotationSummaryGroup$key
) => {
  const data = useFragment<SessionAnnotationSummaryGroup$key>(
    graphql`
      fragment SessionAnnotationSummaryGroup on ProjectSession {
        sessionAnnotations {
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
        sessionAnnotationSummaries {
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
    session
  );
  const { sessionAnnotations, sessionAnnotationSummaries } = data;
  const sortedSummariesByName = sessionAnnotationSummaries
    // Note annotations are not displayed in summary groups
    .filter((summary) => summary.name !== "note")
    .sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
  // newest first
  const annotationsByName = sessionAnnotations.reduce<
    Partial<Record<string, typeof sessionAnnotations>>
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

type SessionAnnotationSummaryGroupProps = {
  session: SessionAnnotationSummaryGroup$key;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  showFilterActions?: boolean;
  renderEmptyState?: () => React.ReactNode;
};

function SessionAnnotationTooltipFilterActions({
  annotation,
}: {
  annotation: {
    name: string;
    label?: string | null;
    score?: number | null;
  };
}) {
  const { appendFilterCondition } = useSessionFilters();
  return (
    <AnnotationTooltipFilterActions
      annotation={annotation}
      onAppendFilterCondition={appendFilterCondition}
    />
  );
}

export const SessionAnnotationSummaryGroupTokens = ({
  session,
  annotationConfigsByName,
  showFilterActions = false,
  renderEmptyState,
}: SessionAnnotationSummaryGroupProps) => {
  const { sortedSummariesByName, annotationsByName } =
    useSessionAnnotationSummaryGroup(session);

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
        <SessionAnnotationTooltipFilterActions annotation={annotation} />
      )}
    />
  );
};

export const SessionAnnotationSummaryGroupStacks = ({
  session,
  annotationConfigsByName,
  renderEmptyState,
  leadingDivider = false,
}: SessionAnnotationSummaryGroupProps & { leadingDivider?: boolean }) => {
  const { sortedSummariesByName, annotationsByName } =
    useSessionAnnotationSummaryGroup(session);

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
