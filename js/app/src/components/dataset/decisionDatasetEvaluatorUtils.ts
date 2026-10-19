import type {
  DecisionProjectionPolicyOutput,
  DecisionProjectionPolicyValue,
  DecisionQuestionDefinition,
  DecisionVersionQuestionsOutput,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import {
  buildDefaultPolicy,
  fitQuestionProjection,
  getQuestionProjectionName,
  normalizePolicy,
  policyOutputToInput,
  questionProjectionsEqual,
  toDecisionQuestionDefinitions,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

/**
 * A decision judge as the create and edit slideovers need it. Structural so a
 * query node and a mutation payload that select these fields are both accepted.
 */
export type DecisionJudgeData = {
  readonly id: string;
  readonly name: string;
  readonly inputSchema: unknown;
  readonly projectionPolicy: DecisionProjectionPolicyOutput;
  readonly decisionVersion: {
    readonly id: string;
    readonly sequenceNumber: number;
    readonly decision: { readonly id: string; readonly name: string };
    readonly questions: DecisionVersionQuestionsOutput;
  };
};

/** What a binding form needs to know about the judge it is bound to. */
export type DecisionJudgeView = {
  /** Null for a judge that has not been created yet. */
  id: string | null;
  name: string;
  /** The declared input names, in declared order. */
  variables: string[];
  questions: DecisionQuestionDefinition[];
  /** The judge's own policy, one entry per question in declared order. */
  policy: DecisionProjectionPolicyValue;
};

/** The property names of a JSON schema object, in declared order. */
export function inputNamesFromSchema(schema: unknown): string[] {
  if (!isStringKeyedObject(schema)) return [];
  const properties = schema.properties;
  return isStringKeyedObject(properties) ? Object.keys(properties) : [];
}

/** Describes a saved judge for a binding form. */
export function toDecisionJudgeView(
  judge: DecisionJudgeData
): DecisionJudgeView {
  const questions = toDecisionQuestionDefinitions(
    judge.decisionVersion.questions
  );
  return {
    id: judge.id,
    name: judge.name,
    variables: inputNamesFromSchema(judge.inputSchema),
    questions,
    policy: normalizePolicy(
      questions,
      policyOutputToInput(judge.projectionPolicy)
    ),
  };
}

/**
 * Drops override entries for questions the version does not declare, or that
 * are a different kind there, and scores for choices it no longer offers. An
 * empty override is null (inherit everything).
 */
export function pruneBindingOverride(
  override: DecisionProjectionPolicyValue | null | undefined,
  questions: readonly DecisionQuestionDefinition[]
): DecisionProjectionPolicyValue | null {
  const definitionByName = new Map(questions.map((q) => [q.name, q]));
  const kept = (override?.questions ?? []).flatMap((question) => {
    const definition = definitionByName.get(
      getQuestionProjectionName(question)
    );
    const isSameKind =
      definition != null &&
      ("predicate" in question
        ? definition.type === "predicate"
        : "choice" in question
          ? definition.type === "choice"
          : definition.type === "scale");
    return isSameKind ? [fitQuestionProjection(definition, question)] : [];
  });
  return kept.length > 0 ? { questions: kept } : null;
}

/** Whether two full policies hold the same settings, question by question. */
export function policiesEqual(
  a: DecisionProjectionPolicyValue,
  b: DecisionProjectionPolicyValue
): boolean {
  return (
    a.questions.length === b.questions.length &&
    a.questions.every((question, index) =>
      questionProjectionsEqual(question, b.questions[index])
    )
  );
}

/** A sparse override as a mutation sends it: null when it overrides nothing. */
export function toBindingPolicyInput(
  override: DecisionProjectionPolicyValue | null | undefined
): DecisionProjectionPolicyValue | null {
  return override && override.questions.length > 0 ? override : null;
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

/** A one-line summary of a binding's override, e.g. "2 questions overridden". */
export function overrideSummary(
  override: DecisionProjectionPolicyValue | null | undefined
): string {
  const count = override?.questions.length ?? 0;
  if (count === 0) return "Inherits the judge's settings";
  return `${count} ${count === 1 ? "question" : "questions"} overridden`;
}

/** "Defaults" while a judge's policy matches the defaults, else "Customized". */
export function judgePolicySummary(
  questions: readonly DecisionQuestionDefinition[],
  policy: DecisionProjectionPolicyValue | null | undefined
): string {
  return !policy ||
    policiesEqual(
      normalizePolicy(questions, policy),
      buildDefaultPolicy(questions)
    )
    ? "Defaults"
    : "Customized";
}
