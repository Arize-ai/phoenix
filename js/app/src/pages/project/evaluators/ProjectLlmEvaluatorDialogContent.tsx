import type { ComponentProps } from "react";

import { EditLLMEvaluatorDialogContent } from "@phoenix/components/evaluators/EditLLMEvaluatorDialogContent";
import { useDerivedPlaygroundVariables } from "@phoenix/pages/playground/useDerivedPlaygroundVariables";
import {
  useProjectEvaluatorSubmitHint,
  useUnboundRequiredVariables,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorSubmitHint";
import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

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
  "isSubmitDisabled" | "submitHint"
> & {
  targetType: ProjectEvaluatorTarget;
  isFilterValid: boolean;
}) => {
  const { variableKeys } = useDerivedPlaygroundVariables();
  // Every prompt variable is required: the server marks each one so.
  const unboundVariables = useUnboundRequiredVariables({
    variables: variableKeys,
  });
  const submitHint = useProjectEvaluatorSubmitHint({
    targetType,
    isFilterValid,
    unboundVariables,
    submitLabel: props.mode === "create" ? "create" : "update",
  });
  return (
    <EditLLMEvaluatorDialogContent
      {...props}
      isSubmitDisabled={!isFilterValid || unboundVariables.length > 0}
      submitHint={submitHint}
    />
  );
};
