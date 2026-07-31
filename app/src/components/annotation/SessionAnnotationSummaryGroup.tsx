import React from "react";
import { graphql, useRefetchableFragment } from "react-relay";

import type { SessionAnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/SessionAnnotationSummaryGroup.graphql";
import type { SessionAnnotationSummaryGroupRefetchQuery } from "@phoenix/components/annotation/__generated__/SessionAnnotationSummaryGroupRefetchQuery.graphql";
import { AnnotationSummaryGroupStacksRow } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { AnnotationSummaryTokens } from "@phoenix/components/annotation/AnnotationSummaryTokens";
import {
  getAnnotationConfig,
  getAnnotations,
  SessionDetailPanelAnnotationConfigButton,
  useAnnotationConfigMutationHandlers,
  useAnnotationMutationHandlers,
} from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import {
  Summary,
  SummaryValue,
} from "@phoenix/pages/project/AnnotationSummary";
import type { AnnotationConfigCategorical } from "@phoenix/pages/settings/types";

const useSessionAnnotationSummaryGroup = (
  session: SessionAnnotationSummaryGroup$key
) => {
  const [data, refetch] = useRefetchableFragment<
    SessionAnnotationSummaryGroupRefetchQuery,
    SessionAnnotationSummaryGroup$key
  >(
    graphql`
      fragment SessionAnnotationSummaryGroup on ProjectSession
      @refetchable(queryName: "SessionAnnotationSummaryGroupRefetchQuery") {
        id
        project {
          id
          annotationConfigs {
            edges {
              node {
                ...ConnectedDetailPanelAnnotationBarConfigFields
              }
            }
          }
        }
        sessionAnnotations {
          ...ConnectedDetailPanelAnnotationBarAnnotationFields
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
  const { sessionAnnotationSummaries } = data;
  const sessionAnnotations = getAnnotations(data.sessionAnnotations);
  const projectAnnotationConfigs = data.project.annotationConfigs.edges.map(
    ({ node }) => getAnnotationConfig(node)
  );
  const sortedSummariesByName = sessionAnnotationSummaries
    // Note annotations are not displayed in summary groups
    .filter((summary) => summary.name !== "note")
    .sort((firstSummary, secondSummary) => {
      return firstSummary.name.localeCompare(secondSummary.name);
    });
  // newest first
  const annotationsByName = sessionAnnotations.reduce<
    Record<string, typeof sessionAnnotations>
  >((annotationsByName, annotation) => {
    if (annotation.label == null && annotation.score == null) {
      return annotationsByName;
    }
    if (!annotationsByName[annotation.name]) {
      annotationsByName[annotation.name] = [annotation];
    } else {
      annotationsByName[annotation.name] = [
        annotation,
        ...annotationsByName[annotation.name],
      ].sort((firstAnnotation, secondAnnotation) => {
        return (
          new Date(secondAnnotation.createdAt ?? 0).getTime() -
          new Date(firstAnnotation.createdAt ?? 0).getTime()
        );
      });
    }
    return annotationsByName;
  }, {});
  const categoricalAnnotationConfigsByName = projectAnnotationConfigs.reduce<
    Record<string, AnnotationConfigCategorical>
  >((configsByName, annotationConfig) => {
    if (annotationConfig.annotationType === "CATEGORICAL") {
      configsByName[annotationConfig.name] = annotationConfig;
    }
    return configsByName;
  }, {});
  const annotationConfigsByName = Object.fromEntries(
    projectAnnotationConfigs.map((annotationConfig) => [
      annotationConfig.name,
      annotationConfig,
    ])
  );
  return {
    annotationConfigsByName,
    projectId: data.project.id,
    refetch,
    sessionAnnotations,
    sessionId: data.id,
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

export const SessionAnnotationSummaryGroupTokens = ({
  session,
  showFilterActions = false,
  renderEmptyState,
}: SessionAnnotationSummaryGroupProps) => {
  const {
    annotationConfigsByName,
    projectId,
    refetch,
    sessionAnnotations,
    sessionId,
    sortedSummariesByName,
    annotationsByName,
    categoricalAnnotationConfigsByName,
  } = useSessionAnnotationSummaryGroup(session);
  const refresh = () => {
    refetch({}, { fetchPolicy: "network-only" });
  };
  const configHandlers = useAnnotationConfigMutationHandlers({
    projectId,
    refresh,
  });
  const annotationHandlers = useAnnotationMutationHandlers({ refresh });

  const summariesWithTokens = sortedSummariesByName.filter(
    (summary) => annotationsByName[summary.name]?.[0] != null
  );

  if (summariesWithTokens.length === 0 && renderEmptyState) {
    return renderEmptyState();
  }

  return (
    <>
      <AnnotationSummaryTokens
        summaries={summariesWithTokens}
        annotationsByName={annotationsByName}
        categoricalAnnotationConfigsByName={categoricalAnnotationConfigsByName}
        editableAnnotationPopover={
          showFilterActions
            ? {
                annotationConfigsByName,
                onCreateAnnotationConfig:
                  configHandlers.onCreateAnnotationConfig,
                onUpdateAnnotationConfig:
                  configHandlers.onUpdateAnnotationConfig,
                ...annotationHandlers,
                target: {
                  annotations: sessionAnnotations,
                  id: sessionId,
                  kind: "session",
                  label: "This session",
                },
              }
            : undefined
        }
        showFilterActions={showFilterActions}
      />
      {showFilterActions ? (
        <SessionDetailPanelAnnotationConfigButton
          sessionNodeId={sessionId}
          variant={summariesWithTokens.length === 0 ? "ghost" : "icon"}
        />
      ) : null}
    </>
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
