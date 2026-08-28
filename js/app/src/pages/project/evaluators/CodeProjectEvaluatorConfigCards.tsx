import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { CodeEvaluatorSandboxCard } from "@phoenix/components/evaluators/CodeEvaluatorSandboxCard";
import { EvaluatorInputMappingCard } from "@phoenix/components/evaluators/EvaluatorInputMappingCard";
import type { CodeProjectEvaluatorConfigCards_projectEvaluator$key } from "@phoenix/pages/project/evaluators/__generated__/CodeProjectEvaluatorConfigCards_projectEvaluator.graphql";
import { formatEvaluationTargetPlural } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/**
 * The configuration cards a code project evaluator adds to the overview's
 * aside: the sandbox it executes in and the mapping from the evaluated
 * payload's fields to the evaluator function's args -- mirroring the right
 * column of the code dataset evaluator details page.
 */
export function CodeProjectEvaluatorConfigCards({
  projectEvaluatorRef,
}: {
  projectEvaluatorRef: CodeProjectEvaluatorConfigCards_projectEvaluator$key;
}) {
  const projectEvaluator = useFragment(
    graphql`
      fragment CodeProjectEvaluatorConfigCards_projectEvaluator on ProjectEvaluator {
        evaluationTarget
        inputMapping {
          literalMapping
          pathMapping
        }
        evaluator {
          ... on CodeEvaluator {
            sandboxConfig {
              ...CodeEvaluatorSandboxCard_sandboxConfig
            }
          }
        }
      }
    `,
    projectEvaluatorRef
  );

  return (
    <>
      <CodeEvaluatorSandboxCard
        sandboxConfigRef={projectEvaluator.evaluator.sandboxConfig}
      />
      <EvaluatorInputMappingCard
        inputMapping={projectEvaluator.inputMapping}
        pathMappingDescription={`Map function args to fields on evaluated ${formatEvaluationTargetPlural(
          projectEvaluator.evaluationTarget
        )}`}
      />
    </>
  );
}
