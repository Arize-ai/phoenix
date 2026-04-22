import { graphql, useMutation } from "react-relay";

import type { SecretsMutationMutation } from "./__generated__/SecretsMutationMutation.graphql";

export function useSecretMutation() {
  return useMutation<SecretsMutationMutation>(graphql`
    mutation SecretsMutationMutation($input: UpsertOrDeleteSecretsMutationInput!) {
      upsertOrDeleteSecrets(input: $input) {
        __typename
      }
    }
  `);
}
