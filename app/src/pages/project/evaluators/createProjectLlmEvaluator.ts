import { createLLMEvaluatorDefinitionPayload } from "@phoenix/components/evaluators/utils";
import type { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import type { CreateProjectLLMEvaluatorInput } from "@phoenix/pages/project/evaluators/__generated__/CreateLLMProjectEvaluatorSlideover_createProjectLlmEvaluatorMutation.graphql";
import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type { EvaluatorInputMapping } from "@phoenix/types";

const EVALUATION_TARGET_BY_PROJECT_TARGET: Record<
  ProjectEvaluatorTarget,
  CreateProjectLLMEvaluatorInput["evaluationTarget"]
> = {
  span: "SPAN",
  trace: "TRACE",
  session: "SESSION",
};

export function createProjectLLMEvaluatorPayload({
  playgroundStore,
  instanceId,
  projectId,
  targetType,
  name,
  description,
  outputConfigs,
  inputMapping,
  includeExplanation,
}: {
  playgroundStore: ReturnType<typeof usePlaygroundStore>;
  instanceId: number;
  projectId: string;
  targetType: ProjectEvaluatorTarget;
  name: string;
  description: string;
  outputConfigs: AnnotationConfig[];
  inputMapping: EvaluatorInputMapping;
  includeExplanation: boolean;
}): CreateProjectLLMEvaluatorInput {
  return {
    ...createLLMEvaluatorDefinitionPayload({
      playgroundStore,
      instanceId,
      name,
      description,
      outputConfigs,
      includeExplanation,
    }),
    projectId,
    inputMapping,
    evaluationTarget: EVALUATION_TARGET_BY_PROJECT_TARGET[targetType],
    // TODO: enable customizing the below fields
    samplingRate: 1,
    filterCondition: "",
    enabled: true,
  };
}
