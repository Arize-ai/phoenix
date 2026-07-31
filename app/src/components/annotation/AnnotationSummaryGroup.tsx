import React from "react";
import { graphql, useRefetchableFragment } from "react-relay";

import { Flex } from "@phoenix/components";
import type { AnnotationSummaryGroup$key } from "@phoenix/components/annotation/__generated__/AnnotationSummaryGroup.graphql";
import type { AnnotationSummaryGroupRefetchQuery } from "@phoenix/components/annotation/__generated__/AnnotationSummaryGroupRefetchQuery.graphql";
import { AnnotationSummaryTokens } from "@phoenix/components/annotation/AnnotationSummaryTokens";
import {
  getAnnotationConfig,
  getAnnotations,
  SpanDetailPanelAnnotationConfigButton,
  useAnnotationConfigMutationHandlers,
  useAnnotationMutationHandlers,
} from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import { Divider } from "@phoenix/components/core/layout";
import {
  Summary,
  SummaryValue,
} from "@phoenix/pages/project/AnnotationSummary";
import type { AnnotationConfigCategorical } from "@phoenix/pages/settings/types";

const useAnnotationSummaryGroup = (span: AnnotationSummaryGroup$key) => {
  const [data, refetch] = useRefetchableFragment<
    AnnotationSummaryGroupRefetchQuery,
    AnnotationSummaryGroup$key
  >(
    graphql`
      fragment AnnotationSummaryGroup on Span
      @refetchable(queryName: "AnnotationSummaryGroupRefetchQuery") {
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
        spanAnnotations {
          ...ConnectedDetailPanelAnnotationBarAnnotationFields
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
  const { spanAnnotationSummaries } = data;
  const spanAnnotations = getAnnotations(data.spanAnnotations);
  const projectAnnotationConfigs = data.project.annotationConfigs.edges.map(
    ({ node }) => getAnnotationConfig(node)
  );
  const sortedSummariesByName = spanAnnotationSummaries
    // Note annotations are not displayed in summary groups
    .filter((summary) => summary.name !== "note")
    .sort((firstSummary, secondSummary) => {
      return firstSummary.name.localeCompare(secondSummary.name);
    });
  // newest first
  const annotationsByName = spanAnnotations.reduce<
    Record<string, typeof spanAnnotations>
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
    spanAnnotations,
    spanId: data.id,
    sortedSummariesByName,
    annotationsByName,
    categoricalAnnotationConfigsByName,
  };
};

type AnnotationSummaryGroupProps = {
  span: AnnotationSummaryGroup$key;
  showFilterActions?: boolean;
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
  showFilterActions = false,
  renderEmptyState,
}: AnnotationSummaryGroupProps) => {
  const {
    annotationConfigsByName,
    projectId,
    refetch,
    spanAnnotations,
    spanId,
    sortedSummariesByName,
    annotationsByName,
    categoricalAnnotationConfigsByName,
  } = useAnnotationSummaryGroup(span);
  const refresh = () => {
    refetch({}, { fetchPolicy: "network-only" });
  };
  const configHandlers = useAnnotationConfigMutationHandlers({
    projectId,
    refresh,
  });
  const annotationHandlers = useAnnotationMutationHandlers({ refresh });

  // a summary of explanation-only annotations has no label or score to render a
  // token from, so counting it would leave the caller a blank run of tokens
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
                  annotations: spanAnnotations,
                  id: spanId,
                  kind: "span",
                  label: "This span",
                },
              }
            : undefined
        }
        showFilterActions={showFilterActions}
      />
      {showFilterActions ? (
        <SpanDetailPanelAnnotationConfigButton
          spanNodeId={spanId}
          variant={summariesWithTokens.length === 0 ? "ghost" : "icon"}
        />
      ) : null}
    </>
  );
};

export const AnnotationSummaryGroupStacks = ({
  span,
  renderEmptyState,
  leadingDivider = false,
}: AnnotationSummaryGroupProps & { leadingDivider?: boolean }) => {
  const {
    sortedSummariesByName,
    annotationsByName,
    categoricalAnnotationConfigsByName,
  } = useAnnotationSummaryGroup(span);

  const stacks = sortedSummariesByName
    .map((summary) => {
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
