import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay";
import { useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import type { projectEvaluatorDetailsQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorDetailsQuery.graphql";
import type { ProjectEvaluatorCreationMode } from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";
import { CreateProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";
import { EditProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/EditProjectEvaluatorSlideover";
import {
  buildAttachCodeCreationMode,
  buildCopyLlmCreationMode,
  isCodeProjectEvaluatorDetails,
  isLlmProjectEvaluatorDetails,
  projectEvaluatorDetailsQueryNode,
  UNSUPPORTED_PROMPT_TEMPLATE_ERROR,
} from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";

/**
 * Route elements for the project evaluator slideovers. Every creation flow and
 * the edit flow is its own route, so each is deep-linkable and the browser's
 * back button closes whichever one is open.
 */

/**
 * Returns the slideover's `onOpenChange`, which closes it by returning to the
 * evaluators list.
 *
 * Closing replaces rather than pushes, so a slideover the user has dismissed
 * does not sit one step back in history waiting to be reopened.
 */
function useCloseSlideover() {
  const navigate = useNavigate();
  const { list } = useProjectEvaluatorPaths();
  return (isOpen: boolean) => {
    if (!isOpen) {
      navigate(list, { replace: true });
    }
  };
}

function useRouteProjectId() {
  const { projectId } = useParams();
  invariant(projectId, "projectId is required");
  return projectId;
}

/**
 * The evaluator a copy or attach route is seeded from. Suspends, so the
 * slideover opens only once that evaluator has loaded.
 */
function useSourceEvaluator() {
  const { evaluatorId } = useParams();
  invariant(evaluatorId, "evaluatorId is required");
  const data = useLazyLoadQuery<projectEvaluatorDetailsQuery>(
    projectEvaluatorDetailsQueryNode,
    { id: evaluatorId },
    { fetchPolicy: "store-or-network" }
  );
  invariant(data.evaluator, "evaluator details could not be loaded");
  return data.evaluator;
}

type CreationModeResult =
  | { ok: true; mode: ProjectEvaluatorCreationMode }
  | { ok: false; error: string };

export function NewLlmProjectEvaluatorPage() {
  const projectId = useRouteProjectId();
  const onOpenChange = useCloseSlideover();
  return (
    <CreateProjectEvaluatorSlideover
      isOpen
      onOpenChange={onOpenChange}
      projectId={projectId}
      creationMode={{ kind: "scratch" }}
    />
  );
}

export function NewCodeProjectEvaluatorPage() {
  const projectId = useRouteProjectId();
  const onOpenChange = useCloseSlideover();
  return (
    <CreateProjectEvaluatorSlideover
      isOpen
      onOpenChange={onOpenChange}
      projectId={projectId}
      creationMode={{ kind: "newCode" }}
    />
  );
}

export function CopyLlmProjectEvaluatorPage() {
  const projectId = useRouteProjectId();
  const onOpenChange = useCloseSlideover();
  const evaluator = useSourceEvaluator();
  const result = useMemo<CreationModeResult>(() => {
    if (!isLlmProjectEvaluatorDetails(evaluator)) {
      return { ok: false, error: "This evaluator is not an LLM evaluator." };
    }
    const built = buildCopyLlmCreationMode(evaluator);
    return built.ok
      ? { ok: true, mode: built.mode }
      : { ok: false, error: UNSUPPORTED_PROMPT_TEMPLATE_ERROR };
  }, [evaluator]);
  if (!result.ok) {
    return (
      <SlideoverErrorDialog
        title="Cannot copy evaluator"
        message={result.error}
        onOpenChange={onOpenChange}
      />
    );
  }
  return (
    <CreateProjectEvaluatorSlideover
      isOpen
      onOpenChange={onOpenChange}
      projectId={projectId}
      creationMode={result.mode}
    />
  );
}

export function AttachCodeProjectEvaluatorPage() {
  const projectId = useRouteProjectId();
  const onOpenChange = useCloseSlideover();
  const evaluator = useSourceEvaluator();
  const creationMode = useMemo(
    () =>
      isCodeProjectEvaluatorDetails(evaluator)
        ? buildAttachCodeCreationMode(evaluator)
        : null,
    [evaluator]
  );
  if (!creationMode) {
    return (
      <SlideoverErrorDialog
        title="Cannot attach evaluator"
        message="This evaluator is not a code evaluator."
        onOpenChange={onOpenChange}
      />
    );
  }
  return (
    <CreateProjectEvaluatorSlideover
      isOpen
      onOpenChange={onOpenChange}
      projectId={projectId}
      creationMode={creationMode}
    />
  );
}

export function EditProjectEvaluatorPage() {
  const { projectEvaluatorId } = useParams();
  invariant(projectEvaluatorId, "projectEvaluatorId is required");
  const onOpenChange = useCloseSlideover();
  return (
    <EditProjectEvaluatorSlideover
      isOpen
      onOpenChange={onOpenChange}
      projectEvaluatorId={projectEvaluatorId}
    />
  );
}

function SlideoverErrorDialog({
  title,
  message,
  onOpenChange,
}: {
  title: string;
  message: string;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <ModalOverlay isOpen isDismissable onOpenChange={onOpenChange}>
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <Text>{message}</Text>
            </View>
            <DialogFooter>
              <Button slot="close">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
