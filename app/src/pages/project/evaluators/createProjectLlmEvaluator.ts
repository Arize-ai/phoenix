import type { Environment } from "relay-runtime";
import { commitMutation, graphql } from "relay-runtime";

import type { createProjectLlmEvaluatorMutation } from "@phoenix/pages/project/evaluators/__generated__/createProjectLlmEvaluatorMutation.graphql";

export type CreateProjectLLMEvaluatorResult = {
  id: string;
  name: string;
};

const mutation = graphql`
  mutation createProjectLlmEvaluatorMutation(
    $input: CreateProjectLLMEvaluatorInput!
    $connectionIds: [ID!]!
  ) {
    createProjectLlmEvaluator(input: $input) {
      evaluator
        @appendNode(
          connections: $connectionIds
          edgeTypeName: "ProjectEvaluatorEdge"
        ) {
        id
        name
        evaluationTarget
        filterCondition
        samplingRate
        enabled
        evaluator {
          kind
        }
      }
    }
  }
`;

export function createProjectLlmEvaluator({
  environment,
  input,
  updateConnectionIds = [],
}: {
  environment: Environment;
  input: createProjectLlmEvaluatorMutation["variables"]["input"];
  updateConnectionIds?: string[];
}): Promise<CreateProjectLLMEvaluatorResult> {
  return new Promise((resolve, reject) => {
    commitMutation<createProjectLlmEvaluatorMutation>(environment, {
      mutation,
      variables: { input, connectionIds: updateConnectionIds },
      onCompleted(response, errors) {
        if (errors?.length) {
          reject(new Error(errors.map(({ message }) => message).join("\n")));
          return;
        }
        const evaluator = response.createProjectLlmEvaluator.evaluator;
        resolve({ id: evaluator.id, name: evaluator.name });
      },
      onError: reject,
    });
  });
}
