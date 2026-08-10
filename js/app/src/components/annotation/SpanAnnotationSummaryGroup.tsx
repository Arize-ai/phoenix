import type { ReactNode } from "react";
import { graphql, useFragment } from "react-relay";

import type { SpanAnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/SpanAnnotationSummaryGroup.graphql";
import { AnnotationSummaryTokens } from "@phoenix/components/annotation/AnnotationSummaryTokens";
import type { Annotation } from "@phoenix/components/annotation/types";

import { hasAnnotationValue } from "./annotationUtils";
import type { AnnotationOptimizationConfig } from "./optimizationUtils";

const useSpanAnnotationSummaryGroup = (
  span: SpanAnnotationSummaryGroup$key
) => {
  const data = useFragment<SpanAnnotationSummaryGroup$key>(
    graphql`
      fragment SpanAnnotationSummaryGroup on Span {
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
    .sort((firstSummary, secondSummary) => {
      return firstSummary.name.localeCompare(secondSummary.name);
    });
  // newest first
  const annotationsByName = spanAnnotations.reduce<
    Partial<Record<string, typeof spanAnnotations>>
  >((annotationsByName, annotation) => {
    const annotationsForName = annotationsByName[annotation.name];
    if (annotationsForName == null) {
      annotationsByName[annotation.name] = [annotation];
    } else {
      annotationsByName[annotation.name] = [
        annotation,
        ...annotationsForName,
      ].sort((firstAnnotation, secondAnnotation) => {
        return (
          new Date(secondAnnotation.createdAt).getTime() -
          new Date(firstAnnotation.createdAt).getTime()
        );
      });
    }
    return annotationsByName;
  }, {});
  return {
    sortedSummariesByName,
    annotationsByName,
  };
};

type SpanAnnotationSummaryGroupProps = {
  span: SpanAnnotationSummaryGroup$key;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  showFilterActions?: boolean;
  renderFilterActions?: (annotation: Annotation) => ReactNode;
  renderEmptyState?: () => ReactNode;
};

export const SpanAnnotationSummaryGroupTokens = ({
  span,
  annotationConfigsByName,
  showFilterActions = false,
  renderFilterActions,
  renderEmptyState,
}: SpanAnnotationSummaryGroupProps) => {
  const { sortedSummariesByName, annotationsByName } =
    useSpanAnnotationSummaryGroup(span);

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
