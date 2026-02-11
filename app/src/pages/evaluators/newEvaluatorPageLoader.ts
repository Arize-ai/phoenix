import { graphql, loadQuery } from "react-relay";
import { LoaderFunction } from "react-router";

import { newEvaluatorPageLoaderQuery } from "@phoenix/pages/evaluators/__generated__/newEvaluatorPageLoaderQuery.graphql";
import RelayEnvironment from "@phoenix/RelayEnvironment";

const newEvaluatorPageLoaderGQL = graphql`
  query newEvaluatorPageLoaderQuery($datasetId: ID!) {
    dataset: node(id: $datasetId) {
      __typename
      ... on Dataset {
        id
        name
      }
    }
  }
`;

export const newEvaluatorPageLoader: LoaderFunction = (args) => {
  const { datasetId } = args.params;
  if (datasetId) {
    return loadQuery<newEvaluatorPageLoaderQuery>(
      RelayEnvironment,
      newEvaluatorPageLoaderGQL,
      {
        datasetId,
      }
    );
  }

  return null;
};

export type NewEvaluatorPageLoaderData = ReturnType<
  typeof newEvaluatorPageLoader
>;
