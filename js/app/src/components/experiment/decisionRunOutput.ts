import { graphql } from "react-relay";

import {
  type NormalizedDecisionAnswer,
  normalizeDecisionAnswers,
} from "@phoenix/components/decision/decisionAnswers";
import {
  type FetchedDecisionQuestion,
  toDraftQuestion,
  toSavedDecisionQuestions,
} from "@phoenix/pages/playground/savedDecisionUtils";
import type { DecisionQuestionDraft } from "@phoenix/store/playground";
import { isStringKeyedObject } from "@phoenix/typeUtils";

/**
 * The questions a decision experiment asked. Spread it unmasked
 * (`@relay(mask: false)`) on each compared experiment so its runs can be read
 * against its own questions.
 */
export const decisionRunOutputFragment = graphql`
  fragment decisionRunOutput_experiment on Experiment {
    job {
      taskConfig {
        __typename
        ... on DecisionTaskConfig {
          questions {
            __typename
            ... on DecisionPredicateQuestion {
              name
              instructions
              criteria {
                true
                false
              }
            }
            ... on DecisionChoiceQuestion {
              name
              instructions
              choices {
                value
                description
              }
            }
            ... on DecisionScaleQuestion {
              name
              instructions
              levels {
                label
                description
              }
            }
          }
        }
      }
    }
  }
`;

type ExperimentTaskConfig =
  | {
      readonly __typename: "DecisionTaskConfig";
      readonly questions: ReadonlyArray<FetchedDecisionQuestion>;
    }
  | { readonly __typename: string };

function isDecisionTaskConfig(
  taskConfig: ExperimentTaskConfig
): taskConfig is Extract<
  ExperimentTaskConfig,
  { __typename: "DecisionTaskConfig" }
> {
  return taskConfig.__typename === "DecisionTaskConfig";
}

/**
 * The questions a decision experiment asked, or null for any other task.
 * @param taskConfig - the experiment's `job.taskConfig`
 */
export function getDecisionTaskQuestions(
  taskConfig: ExperimentTaskConfig | null | undefined
): DecisionQuestionDraft[] | null {
  if (!taskConfig || !isDecisionTaskConfig(taskConfig)) return null;
  return toSavedDecisionQuestions(taskConfig.questions).map(toDraftQuestion);
}

function parseOutput(output: unknown): unknown {
  if (typeof output !== "string") return output;
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

/**
 * A decision experiment run's answers in question order, or null when the
 * output is not a map of decision answers, so callers fall back to the raw
 * output.
 * @param params.questions - the experiment's questions; null for other tasks
 * @param params.output - the run's output
 */
export function getDecisionRunAnswers({
  questions,
  output,
}: {
  questions: readonly DecisionQuestionDraft[] | null;
  output: unknown;
}): NormalizedDecisionAnswer[] | null {
  if (!questions) return null;
  const parsed = parseOutput(output);
  if (!isStringKeyedObject(parsed) || Object.keys(parsed).length === 0) {
    return null;
  }
  const answers = normalizeDecisionAnswers({ answers: parsed, questions });
  return answers.every((answer) => answer.kind !== "unknown") ? answers : null;
}
