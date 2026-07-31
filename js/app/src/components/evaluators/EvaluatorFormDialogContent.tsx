import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Alert } from "@phoenix/components/core/alert";
import { Button } from "@phoenix/components/core/button";
import { Text } from "@phoenix/components/core/content";
import {
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { EvaluatorForm } from "@phoenix/components/evaluators/EvaluatorForm";

export const EvaluatorFormDialogContent = ({
  title,
  submitLabel,
  cancelLabel = "Cancel",
  onSubmit,
  isSubmitting,
  isSubmitDisabled = false,
  submitHint,
  error,
  errorTitle,
  banner,
  left,
  right,
  renderInputVariables,
  submitButtonProps,
  contentGap = "var(--global-dimension-size-200)",
}: {
  title: string;
  submitLabel: string;
  cancelLabel?: string;
  onSubmit: () => void;
  isSubmitting: boolean;
  isSubmitDisabled?: boolean;
  submitHint?: ReactNode;
  error?: string;
  errorTitle: string;
  banner?: ReactNode;
  left: ReactNode;
  right: ReactNode;
  renderInputVariables: (form: ReactNode) => ReactNode;
  submitButtonProps?: { [key: `data-${string}`]: string };
  contentGap?: string;
}) => {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogTitleExtra>
          <DialogCloseButton isDisabled={isSubmitting} />
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
          gap: ${contentGap};
          overflow: auto;
        `}
      >
        {banner}
        {error ? (
          <Alert variant="danger" title={errorTitle}>
            {error}
          </Alert>
        ) : null}
        {renderInputVariables(<EvaluatorForm left={left} right={right} />)}
      </fieldset>
      <DialogFooter>
        {submitHint ? (
          <Text size="S" color="text-500">
            {submitHint}
          </Text>
        ) : null}
        <Button slot="close" isDisabled={isSubmitting}>
          {cancelLabel}
        </Button>
        <Button
          {...submitButtonProps}
          variant={submitHint ? "default" : "primary"}
          isPending={isSubmitting}
          isDisabled={isSubmitting || isSubmitDisabled}
          onPress={onSubmit}
        >
          {submitLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
