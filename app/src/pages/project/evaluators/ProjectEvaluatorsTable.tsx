import { css } from "@emotion/react";
import { graphql, usePaginationFragment } from "react-relay";

import { Flex, LoadMoreButton, Text, View } from "@phoenix/components";
import { tableCSS } from "@phoenix/components/table/styles";
import type { ProjectEvaluatorsTable_project$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_project.graphql";
import { AddProjectEvaluatorMenu } from "@phoenix/pages/project/evaluators/AddProjectEvaluatorMenu";
import { ProjectEvaluatorActionMenu } from "@phoenix/pages/project/evaluators/ProjectEvaluatorActionMenu";
import { ProjectEvaluatorEnabledSwitch } from "@phoenix/pages/project/evaluators/ProjectEvaluatorEnabledSwitch";
import { ProjectEvaluatorsEmptyGallery } from "@phoenix/pages/project/evaluators/ProjectEvaluatorsEmptyGallery";

const PAGE_SIZE = 30;

export function ProjectEvaluatorsTable({
  project,
  projectId,
}: {
  project: ProjectEvaluatorsTable_project$key;
  projectId: string;
}) {
  const { data, hasNext, isLoadingNext, loadNext } = usePaginationFragment(
    graphql`
      fragment ProjectEvaluatorsTable_project on Project
      @refetchable(queryName: "ProjectEvaluatorsTablePaginationQuery")
      @argumentDefinitions(
        first: { type: "Int", defaultValue: 30 }
        after: { type: "String", defaultValue: null }
      ) {
        evaluators(first: $first, after: $after)
          @connection(key: "ProjectEvaluatorsTable_evaluators") {
          __id
          edges {
            node {
              id
              name
              evaluationTarget
              filterCondition
              samplingRate
              enabled
              evaluator {
                kind
                description
                ... on CodeEvaluator {
                  inputMapping {
                    pathMapping
                    literalMapping
                  }
                }
              }
            }
          }
        }
      }
    `,
    project
  );
  const connectionIds = [data.evaluators.__id];
  const rows = data.evaluators.edges;
  return (
    <>
      <View padding="size-100" flex="none">
        <Flex direction="row" justifyContent="end">
          <AddProjectEvaluatorMenu
            size="M"
            projectId={projectId}
            updateConnectionIds={connectionIds}
          />
        </Flex>
      </View>
      <div
        css={css`
          flex: 1 1 auto;
          min-height: 0;
          overflow: auto;
        `}
      >
        <table css={tableCSS} aria-label="Project evaluators">
          <thead>
            <tr>
              <th>Name</th>
              <th>Target</th>
              <th>Filter</th>
              <th>Sampling</th>
              <th>Enabled</th>
              <th>Actions</th>
            </tr>
          </thead>
          {rows.length === 0 ? (
            <ProjectEvaluatorsEmptyGallery
              projectId={projectId}
              updateConnectionIds={connectionIds}
            />
          ) : (
            <tbody>
              {rows.map(({ node }) => (
                <tr key={node.id}>
                  <td>{node.name}</td>
                  <td>{formatEvaluationTarget(node.evaluationTarget)}</td>
                  <td>
                    <Text color={node.filterCondition ? undefined : "text-700"}>
                      {node.filterCondition || "All spans"}
                    </Text>
                  </td>
                  <td>{formatSamplingRate(node.samplingRate)}</td>
                  <td>
                    <ProjectEvaluatorEnabledSwitch
                      projectEvaluatorId={node.id}
                      kind={node.evaluator.kind}
                      name={node.name}
                      enabled={node.enabled}
                      samplingRate={node.samplingRate}
                      evaluationTarget={node.evaluationTarget}
                      filterCondition={node.filterCondition}
                      description={node.evaluator.description ?? null}
                      evaluatorInputMapping={
                        node.evaluator.inputMapping ?? null
                      }
                    />
                  </td>
                  <td>
                    <ProjectEvaluatorActionMenu
                      projectEvaluatorId={node.id}
                      evaluatorKind={node.evaluator.kind}
                      evaluatorName={node.name}
                      updateConnectionIds={connectionIds}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {hasNext ? (
          <View padding="size-100">
            <Flex justifyContent="center">
              <LoadMoreButton
                isLoadingNext={isLoadingNext}
                onLoadMore={() => loadNext(PAGE_SIZE)}
              />
            </Flex>
          </View>
        ) : null}
      </div>
    </>
  );
}

function formatEvaluationTarget(target: "SPAN" | "TRACE" | "SESSION") {
  return `${target.charAt(0)}${target.slice(1).toLowerCase()}`;
}

function formatSamplingRate(samplingRate: number) {
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(samplingRate);
}
