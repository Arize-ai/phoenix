import { commitMutation } from "react-relay";
import type {
  Environment,
  GraphQLTaggedNode,
  MutationParameters,
} from "relay-runtime";

/** Relay's callback API as a promise; GraphQL errors reject like network ones. */
export function commitEvaluatorMutation<T extends MutationParameters>(
  environment: Environment,
  mutation: GraphQLTaggedNode,
  variables: T["variables"]
): Promise<T["response"]> {
  return new Promise((resolve, reject) => {
    commitMutation<T>(environment, {
      mutation,
      variables,
      onCompleted: (response, errors) => {
        const messages = errors?.map((error) => error.message) ?? [];

        if (messages.length) reject(new Error(messages.join("\n")));
        else resolve(response);
      },
      onError: reject,
    });
  });
}
