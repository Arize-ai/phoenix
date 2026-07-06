import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export type CreateProjectLLMEvaluatorResult = {
  id: string;
  name: string;
};

/**
 * TODO(project-evaluators): replace with a createProjectLlmEvaluator Relay
 * mutation once the project-evaluator GraphQL schema lands. Building the full
 * mutation input (prompt version, output configs, input mapping) comes with
 * that swap — see CreateLLMDatasetEvaluatorSlideover for the pattern.
 */
export async function createProjectLlmEvaluator({
  name,
}: {
  projectId: string;
  targetType: ProjectEvaluatorTarget;
  name: string;
}): Promise<CreateProjectLLMEvaluatorResult> {
  return {
    id: `stub-project-evaluator:${name}`,
    name,
  };
}
