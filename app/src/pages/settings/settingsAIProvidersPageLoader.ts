import { fetchQuery, graphql } from "react-relay";

import { AllCredentialEnvVarNames } from "@phoenix/constants/generativeConstants";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import { settingsAIProvidersPageLoaderQuery } from "./__generated__/settingsAIProvidersPageLoaderQuery.graphql";

export async function settingsAIProvidersPageLoader() {
  return await fetchQuery<settingsAIProvidersPageLoaderQuery>(
    RelayEnvironment,
    graphql`
      query settingsAIProvidersPageLoaderQuery($secretKeys: [String!]!) {
        ...GenerativeProvidersCard_data @arguments(secretKeys: $secretKeys)
        ...CustomProvidersCard_data
      }
    `,
    { secretKeys: AllCredentialEnvVarNames }
  ).toPromise();
}
