import type {
  DecisionScoringPolicyOutput,
  DecisionScoringPolicyValue,
  DecisionQuestionDefinition,
  DecisionVersionQuestionsOutput,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import {
  buildDefaultPolicy,
  normalizePolicy,
  policyOutputToInput,
  questionScoringEqual,
  toDecisionQuestionDefinitions,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

/**
 * A decision evaluator as the create and edit slideovers need it. Structural so a
 * query node and a mutation payload that select these fields are both accepted.
 */
export type DecisionEvaluatorData = {
  readonly id: string;
  readonly name: string;
  readonly inputSchema: unknown;
  readonly scoringPolicy: DecisionScoringPolicyOutput;
  readonly decisionVersion: {
    readonly id: string;
    readonly decision: { readonly id: string; readonly name: string };
    readonly questions: DecisionVersionQuestionsOutput;
  };
};

/** What a binding form needs to know about the evaluator it is bound to. */
export type DecisionEvaluatorView = {
  /** Null for a evaluator that has not been created yet. */
  id: string | null;
  name: string;
  /** The declared input names, in declared order. */
  variables: string[];
  questions: DecisionQuestionDefinition[];
  /** The evaluator's own policy, one entry per question in declared order. */
  policy: DecisionScoringPolicyValue;
};

/** The property names of a JSON schema object, in declared order. */
export function inputNamesFromSchema(schema: unknown): string[] {
  if (!isStringKeyedObject(schema)) return [];
  const properties = schema.properties;
  return isStringKeyedObject(properties) ? Object.keys(properties) : [];
}

/** Describes a saved evaluator for a binding form. */
export function toDecisionEvaluatorView(
  evaluator: DecisionEvaluatorData
): DecisionEvaluatorView {
  const questions = toDecisionQuestionDefinitions(
    evaluator.decisionVersion.questions
  );
  return {
    id: evaluator.id,
    name: evaluator.name,
    variables: inputNamesFromSchema(evaluator.inputSchema),
    questions,
    policy: normalizePolicy(
      questions,
      policyOutputToInput(evaluator.scoringPolicy)
    ),
  };
}

/** Whether two full policies hold the same settings, question by question. */
export function policiesEqual(
  a: DecisionScoringPolicyValue,
  b: DecisionScoringPolicyValue
): boolean {
  return (
    a.questions.length === b.questions.length &&
    a.questions.every((question, index) =>
      questionScoringEqual(question, b.questions[index])
    )
  );
}

/** The message of a failed mutation, from a network error or GraphQL errors. */
export function getMutationErrorMessage(error: unknown): string {
  return (
    getErrorMessagesFromRelayMutationError(error)?.join("\n") ??
    (error instanceof Error ? error.message : "An unknown error occurred")
  );
}

/** A mutation that returned GraphQL errors instead of data. */
export class MutationPayloadError extends Error {
  constructor(errors: ReadonlyArray<{ message: string }>) {
    super(errors.map((error) => error.message).join("\n"));
    this.name = "MutationPayloadError";
  }
}

/**
 * Runs a `useMutation` commit as a promise that rejects with the GraphQL
 * errors or the network error, so sequential mutations read top to bottom.
 */
export function commitAsync<TResponse, TVariables>(
  commit: (config: {
    variables: TVariables;
    onCompleted: (
      response: TResponse,
      errors: ReadonlyArray<{ message: string }> | null
    ) => void;
    onError: (error: Error) => void;
  }) => unknown,
  variables: TVariables
): Promise<TResponse> {
  return new Promise<TResponse>((resolve, reject) => {
    commit({
      variables,
      onCompleted: (response, errors) => {
        if (errors && errors.length > 0) {
          reject(new MutationPayloadError(errors));
        } else {
          resolve(response);
        }
      },
      onError: reject,
    });
  });
}

/** "Defaults" while a evaluator's policy matches the defaults, else "Customized". */
export function evaluatorPolicySummary(
  questions: readonly DecisionQuestionDefinition[],
  policy: DecisionScoringPolicyValue | null | undefined
): string {
  return !policy ||
    policiesEqual(
      normalizePolicy(questions, policy),
      buildDefaultPolicy(questions)
    )
    ? "Defaults"
    : "Customized";
}
