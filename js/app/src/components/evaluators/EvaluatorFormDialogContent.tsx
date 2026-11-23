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
import type { EvaluatorFormLayoutProps } from "@phoenix/components/evaluators/EvaluatorFormLayout";
import {
  EvaluatorFormLayout,
  RevealInvalidFieldProvider,
  useRevealInvalidField,
} from "@phoenix/components/evaluators/EvaluatorFormLayout";

type EvaluatorFormDialogContentProps = {
  title: string;
  submitLabel: string;
  cancelLabel?: string;
  /**
   * Replaces closing on Cancel and the close button, e.g. to confirm
   * discarding unsaved changes first.
   */
  onCancel?: () => void;
  /** After it settles, the first field left invalid is brought into view. */
  onSubmit: () => unknown;
  isSubmitting: boolean;
  isSubmitDisabled?: boolean;
  submitHint?: ReactNode;
  error?: string;
  errorTitle: string;
  banner?: ReactNode;
  renderInputVariables: (form: ReactNode) => ReactNode;
  submitButtonProps?: { [key: `data-${string}`]: string };
  contentGap?: string;
} & EvaluatorFormLayoutProps;

/**
 * An evaluator form's dialog: the header, the form laid out by
 * {@link EvaluatorFormLayout}, and the footer with its submit button.
 */
export const EvaluatorFormDialogContent = (
  props: EvaluatorFormDialogContentProps
) => (
  <RevealInvalidFieldProvider>
    <EvaluatorFormDialogBody {...props} />
  </RevealInvalidFieldProvider>
);

const EvaluatorFormDialogBody = ({
  title,
  submitLabel,
  cancelLabel = "Cancel",
  onCancel,
  onSubmit,
  isSubmitting,
  isSubmitDisabled = false,
  submitHint,
  error,
  errorTitle,
  banner,
  renderInputVariables,
  submitButtonProps,
  contentGap = "var(--global-dimension-size-200)",
  ...layoutProps
}: EvaluatorFormDialogContentProps) => {
  const revealInvalidField = useRevealInvalidField();
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogTitleExtra>
          {onCancel ? (
            <DialogCloseButton isDisabled={isSubmitting} onPress={onCancel} />
          ) : (
            <DialogCloseButton isDisabled={isSubmitting} />
          )}
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
        {renderInputVariables(<EvaluatorFormLayout {...layoutProps} />)}
      </fieldset>
      <DialogFooter>
        {submitHint ? (
          <Text size="S" color="text-500">
            {submitHint}
          </Text>
        ) : null}
        {onCancel ? (
          <Button isDisabled={isSubmitting} onPress={onCancel}>
            {cancelLabel}
          </Button>
        ) : (
          <Button slot="close" isDisabled={isSubmitting}>
            {cancelLabel}
          </Button>
        )}
        <Button
          {...submitButtonProps}
          variant="primary"
          isPending={isSubmitting}
          isDisabled={isSubmitting || isSubmitDisabled}
          onPress={async () => {
            await onSubmit();
            revealInvalidField();
          }}
        >
          {submitLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
