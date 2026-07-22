import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Alert } from "@phoenix/components/core/alert";
import { Button } from "@phoenix/components/core/button";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { EvaluatorForm } from "@phoenix/components/evaluators/EvaluatorForm";

/**
 * The shared chrome every evaluator create/edit dialog body renders through:
 * header (title + Cancel/submit buttons), a scrollable fieldset with an error
 * alert, and the two-panel {@link EvaluatorForm}. Evaluator-kind-specific
 * concerns (input-variables provider, extra banners, submit test ids) are
 * supplied by the caller so this shell stays kind-agnostic.
 */
export const EvaluatorFormDialogContent = ({
  title,
  submitLabel,
  cancelLabel = "Cancel",
  onSubmit,
  isSubmitting,
  isSubmitDisabled = false,
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
  /** Disables submit while some external form state (e.g. a filter) is invalid. */
  isSubmitDisabled?: boolean;
  error?: string;
  /** Title of the submission-error alert. */
  errorTitle: string;
  /** Optional alert rendered above the submission error (e.g. validation). */
  banner?: ReactNode;
  /** The form's left (configuration) panel. */
  left: ReactNode;
  /** The form's right (test) panel. */
  right: ReactNode;
  /** Wraps the evaluator form in the appropriate input-variables provider. */
  renderInputVariables: (form: ReactNode) => ReactNode;
  /** Data attributes merged onto the submit button (e.g. test ids). */
  submitButtonProps?: { [key: `data-${string}`]: string };
  /** Vertical gap between the fieldset's stacked children. */
  contentGap?: string;
}) => {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogTitleExtra>
          <Button slot="close" isDisabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button
            {...submitButtonProps}
            variant="primary"
            isPending={isSubmitting}
            isDisabled={isSubmitting || isSubmitDisabled}
            onPress={onSubmit}
          >
            {submitLabel}
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
    </DialogContent>
  );
};
