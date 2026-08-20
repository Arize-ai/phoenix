import type { ReactNode } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex } from "@phoenix/components";
import type { AnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/AnnotationSummaryGroup.graphql";
import { AnnotationSummaryTokens } from "@phoenix/components/annotation/AnnotationSummaryTokens";
import type { Annotation } from "@phoenix/components/annotation/types";
import { Divider } from "@phoenix/components/core/layout";

import { groupAnnotationsByName, hasAnnotationValue } from "./annotationUtils";
import type { AnnotationOptimizationConfig } from "./optimizationUtils";

const useAnnotationSummaryGroup = (span: AnnotationSummaryGroup$key) => {
  const data = useFragment<AnnotationSummaryGroup$key>(
    graphql`
      fragment AnnotationSummaryGroup on Span {
        summarySpanAnnotations: spanAnnotations(
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
        summarySpanAnnotationSummaries: spanAnnotationSummaries(
          filter: { exclude: { names: ["note"] } }
        ) {
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
  const { summarySpanAnnotations, summarySpanAnnotationSummaries } = data;
  const sortedSummariesByName = [...summarySpanAnnotationSummaries].sort(
    (firstSummary, secondSummary) => {
      return firstSummary.name.localeCompare(secondSummary.name);
    }
  );
  const annotationsByName = groupAnnotationsByName(summarySpanAnnotations);
  return {
    sortedSummariesByName,
    annotationsByName,
  };
};

type AnnotationSummaryGroupProps = {
  span: AnnotationSummaryGroup$key;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  showFilterActions?: boolean;
  renderFilterActions?: (annotation: Annotation) => ReactNode;
  renderEmptyState?: () => ReactNode;
};

/**
 * Lays out annotation summary stacks as peer columns alongside other header
 * metrics. The group owns its optional leading divider so empty groups do not
 * leave a dangling separator behind.
 */
export function AnnotationSummaryGroupStacksRow({
  leadingDivider = false,
  children,
}: {
  leadingDivider?: boolean;
  children: ReactNode;
}) {
  return (
    <Flex direction="row" gap="size-400" alignItems="stretch" flex="none">
      {leadingDivider ? <Divider orientation="vertical" /> : null}
      {children}
    </Flex>
  );
}

export const AnnotationSummaryGroupTokens = ({
  span,
  annotationConfigsByName,
  showFilterActions = false,
  renderFilterActions,
  renderEmptyState,
}: AnnotationSummaryGroupProps) => {
  const { sortedSummariesByName, annotationsByName } =
    useAnnotationSummaryGroup(span);

  // A summary of explanation-only annotations has no label or score to render
  // a token from, so counting it would leave a blank run of tokens.
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
