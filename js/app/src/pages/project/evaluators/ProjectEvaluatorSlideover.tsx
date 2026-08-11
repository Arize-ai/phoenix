import type { ReactNode } from "react";
import { Suspense, useRef, useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";

import { Dialog, Loading, Modal, ModalOverlay } from "@phoenix/components";
import {
  DiscardEvaluatorChangesDialog,
  isModalUnderlay,
} from "@phoenix/pages/project/evaluators/DiscardEvaluatorChangesDialog";
import type { EvaluatorFormDirtyCheck } from "@phoenix/pages/project/evaluators/useEvaluatorFormDirtyCheck";

/**
 * The shell every project evaluator slideover renders into: the modal, the
 * unsaved-changes guard, and the dialog itself.
 *
 * `title` is required and names the dialog, so a slideover cannot be built
 * without an accessible name. Callers pass the same string to whatever renders
 * the visible heading, which keeps the two equal by construction -- react-aria
 * cannot derive the name from the heading here, because the heading is inside
 * the `Suspense` boundary below and it stops looking before that resolves.
 */
export function ProjectEvaluatorSlideover({
  title,
  children,
  ...props
}: {
  title: string;
  /** Receives the dialog's own close, which the form calls when it is done. */
  children: (
    close: () => void,
    registerDirtyCheck: RegisterDirtyCheck
  ) => ReactNode;
} & Omit<ModalOverlayProps, "children">) {
  const dirtyCheckRef = useRef<EvaluatorFormDirtyCheck>(() => false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const registerDirtyCheck = (check: EvaluatorFormDirtyCheck) => {
    dirtyCheckRef.current = check;
  };
  return (
    <>
      <ModalOverlay
        {...props}
        isDismissable
        shouldCloseOnInteractOutside={(element) => {
          if (!isModalUnderlay(element)) {
            return false;
          }
          if (dirtyCheckRef.current()) {
            setIsDiscardConfirmOpen(true);
            return false;
          }
          return true;
        }}
      >
        <Modal variant="slideover" size="fullscreen">
          <Dialog aria-label={title}>
            {({ close }) => (
              <Suspense fallback={<Loading />}>
                {children(close, registerDirtyCheck)}
              </Suspense>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
      <DiscardEvaluatorChangesDialog
        isOpen={isDiscardConfirmOpen}
        onKeepEditing={() => setIsDiscardConfirmOpen(false)}
        onDiscard={() => {
          setIsDiscardConfirmOpen(false);
          props.onOpenChange?.(false);
        }}
      />
    </>
  );
}

export type RegisterDirtyCheck = (check: EvaluatorFormDirtyCheck) => void;
