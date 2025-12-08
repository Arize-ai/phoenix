import { useFormContext } from "react-hook-form";
import invariant from "tiny-invariant";

import type { EvaluatorConfigDialogForm } from "@phoenix/components/evaluators/EvaluatorConfigDialog/EvaluatorConfigDialog";

export const useEvaluatorConfigDialogForm = () => {
  const form = useFormContext<EvaluatorConfigDialogForm>();
  invariant(
    form,
    "useEvaluatorConfigDialogForm must be used within EvaluatorConfigDialog"
  );
  return form;
};
