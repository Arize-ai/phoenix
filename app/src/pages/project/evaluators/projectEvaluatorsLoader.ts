import { graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { projectEvaluatorsLoaderQuery } from "./__generated__/projectEvaluatorsLoaderQuery.graphql";

export const projectEvaluatorsLoaderGQL = graphql`
  query projectEvaluatorsLoaderQuery($id: ID!) {
    project: node(id: $id) {
      id
      ... on Project {
        id
        ...ProjectEvaluatorsTable_evaluators
      }
    }
  }
`;

/**
 * Loads the data required for the project evaluators page.
 */
export function projectEvaluatorsLoader(args: LoaderFunctionArgs) {
  const { projectId } = args.params;
  invariant(projectId, "projectId is required");
  return loadQuery<projectEvaluatorsLoaderQuery>(
    RelayEnvironment,
    projectEvaluatorsLoaderGQL,
    { id: projectId }
  );
}
