import { fetchQuery, graphql } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { exampleRedirectLoaderQuery } from "./__generated__/exampleRedirectLoaderQuery.graphql";

export async function exampleRedirectLoader({ params }: LoaderFunctionArgs) {
  const { datasetId, externalId } = params;

  if (!datasetId || !externalId) {
    throw new Error(
      "Example redirect requires a dataset ID and an external ID"
    );
  }

  const response = await fetchQuery<exampleRedirectLoaderQuery>(
    RelayEnvironment,
    graphql`
      query exampleRedirectLoaderQuery($datasetId: ID!, $externalId: String!) {
        example: getDatasetExampleByExternalId(
          datasetId: $datasetId
          externalId: $externalId
        ) {
          id
        }
      }
    `,
    {
      datasetId,
      externalId,
    }
  ).toPromise();

  if (response?.example) {
    return redirect(`/datasets/${datasetId}/examples/${response.example.id}`);
  } else {
    throw new Error(
      `Example with external ID "${externalId}" not found in dataset "${datasetId}"`
    );
  }
}
