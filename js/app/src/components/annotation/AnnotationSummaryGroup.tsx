import React from "react";
import { graphql, useFragment } from "react-relay";

import { Flex } from "@phoenix/components";
import type { AnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/AnnotationSummaryGroup.graphql";
import { AnnotationSummaryTokens } from "@phoenix/components/annotation/AnnotationSummaryTokens";
import type { Annotation } from "@phoenix/components/annotation/types";
import { Divider } from "@phoenix/components/core/layout";
import {
  Summary,
  SummaryValue,
} from "@phoenix/pages/project/AnnotationSummary";

import { hasAnnotationValue } from "./annotationUtils";
import type { AnnotationOptimizationConfig } from "./optimizationUtils";

const useAnnotationSummaryGroup = (span: AnnotationSummaryGroup$key) => {
  const data = useFragment<AnnotationSummaryGroup$key>(
    graphql`
      fragment AnnotationSummaryGroup on Span {
        spanAnnotations {
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
  const sortedSummariesByName = spanAnnotationSummaries
    // Note annotations are not displayed in summary groups
    .filter((summary) => summary.name !== "note")
    .sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
  // newest first
  const annotationsByName = spanAnnotations.reduce<
    Partial<Record<string, typeof spanAnnotations>>
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

type AnnotationSummaryGroupProps = {
  span: AnnotationSummaryGroup$key;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  showFilterActions?: boolean;
  renderFilterActions?: (annotation: Annotation) => React.ReactNode;
  renderEmptyState?: () => React.ReactNode;
};

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
  annotationConfigsByName,
  showFilterActions = false,
  renderFilterActions,
  renderEmptyState,
}: AnnotationSummaryGroupProps) => {
  const { sortedSummariesByName, annotationsByName } =
    useAnnotationSummaryGroup(span);

  // a summary of explanation-only annotations has no label or score to render a
  // token from, so counting it would leave the caller a blank run of tokens
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
      renderFilterActions={renderFilterActions}
    />
  );
};

export const AnnotationSummaryGroupStacks = ({
  span,
  annotationConfigsByName,
  renderEmptyState,
  leadingDivider = false,
}: AnnotationSummaryGroupProps & { leadingDivider?: boolean }) => {
  const { sortedSummariesByName, annotationsByName } =
    useAnnotationSummaryGroup(span);

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
