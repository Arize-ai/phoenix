import { graphql, useMutation } from "react-relay";

import type { SecretsMutationMutation } from "./__generated__/SecretsMutationMutation.graphql";

export function useSecretMutation() {
  return useMutation<SecretsMutationMutation>(graphql`
    mutation SecretsMutationMutation(
      $input: UpsertOrDeleteSecretsMutationInput!
      $connections: [ID!]!
    ) {
      upsertOrDeleteSecrets(input: $input) {
        upsertedSecrets
          @deleteEdge(connections: $connections)
          @appendNode(connections: $connections, edgeTypeName: "SecretEdge") {
          id
          key
          updatedAt
          user {
            id
            username
            profilePictureUrl
          }
        }
        deletedIds @deleteEdge(connections: $connections)
      }
    }
  `);
}
