import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { css } from "@emotion/react";

import { Flex } from "@phoenix/components";
import { SessionAnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/SessionAnnotationSummaryGroup.graphql";
import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import { AnnotationSummaryPopover } from "@phoenix/components/annotation/AnnotationSummaryPopover";
import {
  Summary,
  SummaryValue,
  SummaryValuePreview,
} from "@phoenix/pages/project/AnnotationSummary";
import { AnnotationConfigCategorical } from "@phoenix/pages/settings/types";

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
      sessionAnnotations.reduce(
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
        {} as Record<string, typeof sessionAnnotations>
      ),
    [sessionAnnotations]
  );
  const categoricalAnnotationConfigsByName = useMemo(() => {
    return data.project.annotationConfigs.edges.reduce(
      (acc, edge) => {
        const name = edge.node.name;
        if (name && edge.node.annotationType === "CATEGORICAL") {
          acc[name] = edge.node as AnnotationConfigCategorical;
        }
        return acc;
      },
      {} as Record<string, AnnotationConfigCategorical>
    );
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

const annotationLabelCSS = css`
  min-height: 20px;
  align-items: center;
  justify-content: center;
  display: flex;
`;

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
              ) : null}
            </AnnotationLabel>
          </AnnotationSummaryPopover>
        );
      })}
    </Flex>
  );
};

export const SessionAnnotationSummaryGroupStacks = ({
  session,
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
    <Flex direction="row" gap="size-400">
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
              annotationConfig={
                categoricalAnnotationConfigsByName[latestAnnotation.name]
              }
            />
          </Summary>
        );
      })}
    </Flex>
  );
};
