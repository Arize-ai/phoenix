import React, { useMemo } from "react";
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
import type { AnnotationConfigCategorical } from "@phoenix/pages/settings/types";

const useSessionAnnotationSummaryGroup = (
  session: SessionAnnotationSummaryGroup$key
) => {
  const data = useFragment<SessionAnnotationSummaryGroup$key>(
    graphql`
      fragment SessionAnnotationSummaryGroup on ProjectSession {
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
        sessionAnnotations {
          id
          name
          label
          score
          annotatorKind
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
  const sortedSummariesByName = useMemo(
    () =>
      sessionAnnotationSummaries
        // Note annotations are not displayed in summary groups
        .filter((summary) => summary.name !== "note")
        .sort((a, b) => {
          return a.name.localeCompare(b.name);
        }),
    [sessionAnnotationSummaries]
  );
  // newest first - sessions don't have createdAt on annotations
  const annotationsByName = useMemo(
    () =>
      sessionAnnotations.reduce<Record<string, typeof sessionAnnotations>>(
        (acc, annotation) => {
          if (annotation.label == null && annotation.score == null) {
            return acc;
          }
          if (!acc[annotation.name]) {
            acc[annotation.name] = [annotation];
          } else {
            acc[annotation.name] = [annotation, ...acc[annotation.name]];
          }
          return acc;
        },
        {}
      ),
    [sessionAnnotations]
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

type SessionAnnotationSummaryGroupProps = {
  session: SessionAnnotationSummaryGroup$key;
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
  showFilterActions = false,
  renderEmptyState,
}: SessionAnnotationSummaryGroupProps) => {
  const {
    sortedSummariesByName,
    annotationsByName,
    categoricalAnnotationConfigsByName,
  } = useSessionAnnotationSummaryGroup(session);

  if (sortedSummariesByName.length === 0 && renderEmptyState) {
    return renderEmptyState();
  }

  return (
    <AnnotationSummaryTokens
      summaries={sortedSummariesByName}
      annotationsByName={annotationsByName}
      categoricalAnnotationConfigsByName={categoricalAnnotationConfigsByName}
      showFilterActions={showFilterActions}
      renderFilterActions={(annotation) => (
        <SessionAnnotationTooltipFilterActions annotation={annotation} />
      )}
    />
  );
};

export const SessionAnnotationSummaryGroupStacks = ({
  session,
  renderEmptyState,
  leadingDivider = false,
}: SessionAnnotationSummaryGroupProps & { leadingDivider?: boolean }) => {
  const {
    sortedSummariesByName,
    annotationsByName,
    categoricalAnnotationConfigsByName,
  } = useSessionAnnotationSummaryGroup(session);

  if (sortedSummariesByName.length === 0 && renderEmptyState) {
    return renderEmptyState();
  }
  return (
    <AnnotationSummaryGroupStacksRow leadingDivider={leadingDivider}>
      {sortedSummariesByName.map((summary) => {
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
      })}
    </AnnotationSummaryGroupStacksRow>
  );
};
