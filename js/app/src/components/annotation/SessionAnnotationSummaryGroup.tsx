import React from "react";
import { graphql, useFragment } from "react-relay";

import type { SessionAnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/SessionAnnotationSummaryGroup.graphql";
import { AnnotationSummaryGroupStacksRow } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import {
  AnnotationSummaryTokens,
  AnnotationSummaryValueToken,
} from "@phoenix/components/annotation/AnnotationSummaryTokens";
import { getSessionAnnotationTooltipFilters } from "@phoenix/pages/project/annotationFilterUtils";
import {
  Summary,
  SummaryValue,
} from "@phoenix/pages/project/AnnotationSummary";
import { AnnotationTooltipFilterActions } from "@phoenix/pages/project/AnnotationTooltipFilterActions";
import { useSessionFilters } from "@phoenix/pages/project/SessionFiltersContext";

import { groupAnnotationsByName, hasAnnotationValue } from "./annotationUtils";
import type { AnnotationOptimizationConfig } from "./optimizationUtils";
import type { Annotation } from "./types";

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
          updatedAt
          user {
            username
            profilePictureUrl
          }
        }
        summarySessionAnnotationSummaries: sessionAnnotationSummaries(
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
    session
  );
  const { sessionAnnotations, summarySessionAnnotationSummaries } = data;
  const sortedSummariesByName = [...summarySessionAnnotationSummaries].sort(
    (a, b) => {
      return a.name.localeCompare(b.name);
    }
  );
  const annotationsByName = groupAnnotationsByName(sessionAnnotations);
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

type SessionAnnotationSummaryGroupTokenProps = Omit<
  SessionAnnotationSummaryGroupProps,
  "renderEmptyState"
> & {
  annotationName: string;
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
      getFilters={getSessionAnnotationTooltipFilters}
      onAppendFilterCondition={appendFilterCondition}
    />
  );
}

const defaultRenderFilterActions = (annotation: Annotation) => (
  <SessionAnnotationTooltipFilterActions annotation={annotation} />
);

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
      annotationTargetType="session"
      annotationsByName={annotationsByName}
      annotationConfigsByName={annotationConfigsByName}
      showFilterActions={showFilterActions}
      renderFilterActions={defaultRenderFilterActions}
    />
  );
};

export const SessionAnnotationSummaryGroupToken = ({
  session,
  annotationName,
  annotationConfigsByName,
  showFilterActions = false,
}: SessionAnnotationSummaryGroupTokenProps) => {
  const { sortedSummariesByName, annotationsByName } =
    useSessionAnnotationSummaryGroup(session);
  return (
    <AnnotationSummaryValueToken
      annotationName={annotationName}
      annotationTargetType="session"
      sortedSummariesByName={sortedSummariesByName}
      annotationsByName={annotationsByName}
      annotationConfigsByName={annotationConfigsByName}
      showFilterActions={showFilterActions}
      renderFilterActions={defaultRenderFilterActions}
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
