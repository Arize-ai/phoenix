import type { ComponentProps } from "react";

import { EditLLMEvaluatorDialogContent } from "@phoenix/components/evaluators/EditLLMEvaluatorDialogContent";
import { useLLMEvaluatorVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useLLMEvaluatorVariables";
import {
  useProjectEvaluatorSubmitHint,
  useUnboundRequiredVariables,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorSubmitHint";
import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  ProjectEvaluatorWorkspaceLayoutMenu,
  ProjectEvaluatorWorkspaceProvider,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorWorkspace";

/**
 * The LLM evaluator dialog for a project, which will not save while a prompt
 * variable has nothing to read on the record.
 */
export const ProjectLlmEvaluatorDialogContent = ({
  targetType,
  isFilterValid,
  ...props
}: Omit<
  ComponentProps<typeof EditLLMEvaluatorDialogContent>,
  "isSubmitDisabled" | "submitHint" | "formHeaderExtra"
> & {
  targetType: ProjectEvaluatorTarget;
  isFilterValid: boolean;
}) => {
  const variables = useLLMEvaluatorVariables();
  // Every prompt variable is required: the server marks each one so.
  const unboundVariables = useUnboundRequiredVariables({ variables });
  const submitHint = useProjectEvaluatorSubmitHint({
    targetType,
    isFilterValid,
    unboundVariables,
    submitLabel: props.mode === "create" ? "create" : "update",
  });
  return (
    <ProjectEvaluatorWorkspaceProvider>
      <EditLLMEvaluatorDialogContent
        {...props}
        formHeaderExtra={
          props.formWorkspace != null ? (
            <ProjectEvaluatorWorkspaceLayoutMenu />
          ) : null
        }
        isSubmitDisabled={!isFilterValid || unboundVariables.length > 0}
        submitHint={submitHint}
      />
    </ProjectEvaluatorWorkspaceProvider>
  );
};
