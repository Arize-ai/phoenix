import { graphql, readInlineData } from "react-relay";

import {
  type NormalizedDecisionAnswer,
  normalizeDecisionAnswers,
} from "@phoenix/components/decision/decisionAnswers";
import {
  toDraftQuestion,
  toSavedDecisionQuestions,
} from "@phoenix/pages/playground/savedDecisionUtils";
import type { DecisionQuestionDraft } from "@phoenix/store/playground";
import { isStringKeyedObject } from "@phoenix/typeUtils";

import type {
  decisionRunOutput_experiment$data,
  decisionRunOutput_experiment$key,
} from "./__generated__/decisionRunOutput_experiment.graphql";

const decisionRunOutputFragment = graphql`
  fragment decisionRunOutput_experiment on Experiment @inline {
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

type TaskConfig = NonNullable<
  decisionRunOutput_experiment$data["job"]
>["taskConfig"];

/**
 * The questions a decision task asked, or null for any other task.
 * @param taskConfig - an experiment's `job.taskConfig`
 */
export function toDecisionTaskQuestions(
  taskConfig: TaskConfig | null | undefined
): DecisionQuestionDraft[] | null {
  if (taskConfig?.__typename !== "DecisionTaskConfig") return null;
  return toSavedDecisionQuestions(taskConfig.questions).map(toDraftQuestion);
}

/**
 * The questions a decision experiment asked, or null for any other task.
 * @param experiment - an experiment that spreads `decisionRunOutput_experiment`
 */
export function getDecisionTaskQuestions(
  experiment: decisionRunOutput_experiment$key
): DecisionQuestionDraft[] | null {
  return toDecisionTaskQuestions(
    readInlineData(decisionRunOutputFragment, experiment).job?.taskConfig
  );
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
