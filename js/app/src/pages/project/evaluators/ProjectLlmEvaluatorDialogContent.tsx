import type { ComponentProps } from "react";

import { EditLLMEvaluatorDialogContent } from "@phoenix/components/evaluators/EditLLMEvaluatorDialogContent";
import { useLLMEvaluatorVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useLLMEvaluatorVariables";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import {
  getProjectEvaluatorSubmitRefusal,
  type ProjectEvaluatorFilterValidity,
  type ProjectEvaluatorSubmitGateInput,
  useProjectEvaluatorSubmitGate,
} from "@phoenix/pages/project/evaluators/projectEvaluatorSubmitGate";
import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/**
 * The LLM evaluator dialog for a project, which will not save while a prompt
 * variable has nothing to read on the record or the filter does not parse.
 * The dialog's submit is also PXI's, so both are held by the same gate.
 */
export const ProjectLlmEvaluatorDialogContent = ({
  targetType,
  filterValidity,
  onSubmit,
  ...props
}: Omit<
  ComponentProps<typeof EditLLMEvaluatorDialogContent>,
  "isSubmitDisabled" | "submitHint"
> & {
  targetType: ProjectEvaluatorTarget;
  filterValidity: ProjectEvaluatorFilterValidity;
}) => {
  const store = useEvaluatorStoreInstance();
  // Every prompt variable is required: the server marks each one so.
  const variables = useLLMEvaluatorVariables();
  const gateInput: ProjectEvaluatorSubmitGateInput = {
    targetType,
    filterValidity,
    variables,
    submitLabel: props.mode === "create" ? "create" : "update",
  };
  const gate = useProjectEvaluatorSubmitGate(gateInput);
  return (
    <EditLLMEvaluatorDialogContent
      {...props}
      onSubmit={async () =>
        (await getProjectEvaluatorSubmitRefusal({ gate: gateInput, store })) ??
        onSubmit()
      }
      isSubmitDisabled={gate.isSubmitDisabled}
      submitHint={gate.submitHint}
    />
  );
};
