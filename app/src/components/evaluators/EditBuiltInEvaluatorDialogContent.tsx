import { css } from "@emotion/react";

import { Alert } from "@phoenix/components/alert";
import { Button } from "@phoenix/components/button";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { EvaluatorForm } from "@phoenix/components/evaluators/EvaluatorForm";
import { CodeEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/CodeEvaluatorInputVariablesProvider";

export const EditBuiltInEvaluatorDialogContent = ({
  onSubmit,
  isSubmitting,
  mode,
  error,
  evaluatorInputSchema,
}: {
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  mode: "create" | "update";
  error?: string;
  evaluatorInputSchema: unknown;
}) => {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Create Evaluator" : "Edit Evaluator"}
        </DialogTitle>
        <DialogTitleExtra>
          <Button slot="close" isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isDisabled={isSubmitting}
            isPending={isSubmitting}
            onPress={onSubmit}
          >
            {mode === "create" ? "Create" : "Update"}
          </Button>
        </DialogTitleExtra>
      </DialogHeader>
      <fieldset
        disabled={isSubmitting}
        css={css`
          all: unset;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          gap: var(--ac-global-dimension-size-200);
          overflow: auto;
        `}
      >
        {error && (
          <Alert
            variant="danger"
            title={
              mode === "create"
                ? "Failed to create evaluator"
                : "Failed to update evaluator"
            }
          >
            {error}
          </Alert>
        )}
        <CodeEvaluatorInputVariablesProvider
          evaluatorInputSchema={evaluatorInputSchema}
        >
          <EvaluatorForm />
        </CodeEvaluatorInputVariablesProvider>
      </fieldset>
    </DialogContent>
  );
};
