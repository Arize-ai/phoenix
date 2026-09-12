import { fetchQuery, graphql } from "react-relay";
import type { Environment } from "relay-runtime";

import { getEvaluatorCopyName } from "../evaluatorCopyName";
import type { EvaluatorSlotSource } from "../evaluatorPlaygroundSource";
import type { evaluatorCopyNameLookupNamesQuery } from "./__generated__/evaluatorCopyNameLookupNamesQuery.graphql";
import type { evaluatorCopyNameLookupProjectNamesQuery } from "./__generated__/evaluatorCopyNameLookupProjectNamesQuery.graphql";

/**
 * A name for a copy of `base` that no evaluator, and no evaluator on the
 * dataset or project, already uses. Both must be free: the shared evaluator's
 * name is unique across evaluators, the binding's within its dataset or
 * project.
 */
export async function fetchEvaluatorCopyName(
  environment: Environment,
  base: string,
  source: EvaluatorSlotSource
): Promise<string> {
  const filter = { col: "name" as const, value: `${base.trim()}_copy` };

  if (source.kind === "project") {
    const data = await fetchQuery<evaluatorCopyNameLookupProjectNamesQuery>(
      environment,
      projectNamesQuery,
      { filter, projectFilter: filter, projectId: source.projectId }
    ).toPromise();

    return getEvaluatorCopyName(base, [
      ...(data?.evaluators.edges ?? []).map(({ node }) => node.name),
      ...(data?.project?.evaluators?.edges ?? []).map(({ node }) => node.name),
    ]);
  }

  const data = await fetchQuery<evaluatorCopyNameLookupNamesQuery>(
    environment,
    namesQuery,
    { filter }
  ).toPromise();

  const taken = (data?.evaluators.edges ?? []).flatMap(({ node }) => [
    node.name,
    ...node.datasetEvaluators
      .filter((binding) => binding.dataset.id === source.datasetId)
      .map((binding) => binding.name),
  ]);

  return getEvaluatorCopyName(base, taken);
}

const namesQuery = graphql`
  query evaluatorCopyNameLookupNamesQuery($filter: EvaluatorFilter!) {
    evaluators(first: 200, filter: $filter) {
      edges {
        node {
          name
          datasetEvaluators {
            name
            dataset {
              id
            }
          }
        }
      }
    }
  }
`;

const projectNamesQuery = graphql`
  query evaluatorCopyNameLookupProjectNamesQuery(
    $filter: EvaluatorFilter!
    $projectFilter: ProjectEvaluatorFilter!
    $projectId: ID!
  ) {
    evaluators(first: 200, filter: $filter) {
      edges {
        node {
          name
        }
      }
    }
    project: node(id: $projectId) {
      ... on Project {
        evaluators(first: 200, filter: $projectFilter) {
          edges {
            node {
              name
            }
          }
        }
      }
    }
  }
`;
