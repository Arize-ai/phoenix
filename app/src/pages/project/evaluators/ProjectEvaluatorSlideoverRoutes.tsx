import { useLazyLoadQuery } from "react-relay";
import { useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import type { projectEvaluatorDetailsQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorDetailsQuery.graphql";
import { CreateProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";
import {
  EditProjectEvaluatorSlideover,
  useProjectEvaluator,
} from "@phoenix/pages/project/evaluators/EditProjectEvaluatorSlideover";
import {
  buildAttachCodeCreationMode,
  buildCopyLlmCreationMode,
  isCodeProjectEvaluatorDetails,
  isLlmProjectEvaluatorDetails,
  projectEvaluatorDetailsQueryNode,
  UNSUPPORTED_PROMPT_TEMPLATE_ERROR,
} from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import { ProjectEvaluatorSlideoverError } from "@phoenix/pages/project/evaluators/ProjectEvaluatorSlideoverError";

// Route elements for the project evaluator slideovers. Every creation flow and
// the edit flow is its own route, so each is deep-linkable and the browser's
// back button closes whichever one is open.

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
 * The evaluator a copy or attach route is seeded from, or null when the id in
 * the URL names nothing. Suspends, so the slideover opens only once that
 * evaluator has loaded.
 */
function useSourceEvaluator() {
  const { evaluatorId } = useParams();
  invariant(evaluatorId, "evaluatorId is required");
  const data = useLazyLoadQuery<projectEvaluatorDetailsQuery>(
    projectEvaluatorDetailsQueryNode,
    { id: evaluatorId },
    { fetchPolicy: "store-or-network" }
  );
  return data.evaluator;
}

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
  const title = "Cannot copy evaluator";
  if (!evaluator || !isLlmProjectEvaluatorDetails(evaluator)) {
    return (
      <ProjectEvaluatorSlideoverError
        title={title}
        message="This link does not name an LLM evaluator."
        onOpenChange={onOpenChange}
      />
    );
  }
  const built = buildCopyLlmCreationMode(evaluator);
  if (!built.ok) {
    return (
      <ProjectEvaluatorSlideoverError
        title={title}
        message={UNSUPPORTED_PROMPT_TEMPLATE_ERROR}
        onOpenChange={onOpenChange}
      />
    );
  }
  return (
    <CreateProjectEvaluatorSlideover
      isOpen
      onOpenChange={onOpenChange}
      projectId={projectId}
      creationMode={built.mode}
    />
  );
}

export function AttachCodeProjectEvaluatorPage() {
  const projectId = useRouteProjectId();
  const onOpenChange = useCloseSlideover();
  const evaluator = useSourceEvaluator();
  if (!evaluator || !isCodeProjectEvaluatorDetails(evaluator)) {
    return (
      <ProjectEvaluatorSlideoverError
        title="Cannot attach evaluator"
        message="This link does not name a code evaluator."
        onOpenChange={onOpenChange}
      />
    );
  }
  return (
    <CreateProjectEvaluatorSlideover
      isOpen
      onOpenChange={onOpenChange}
      projectId={projectId}
      creationMode={buildAttachCodeCreationMode(evaluator)}
    />
  );
}

export function EditProjectEvaluatorPage() {
  const { projectEvaluatorId } = useParams();
  invariant(projectEvaluatorId, "projectEvaluatorId is required");
  const onOpenChange = useCloseSlideover();
  const { evaluator, sandboxConfigs } = useProjectEvaluator(projectEvaluatorId);
  // Only a hand-written URL reaches this: the table offers Edit for authored
  // evaluators alone.
  if (
    evaluator.evaluator.kind !== "LLM" &&
    evaluator.evaluator.kind !== "CODE"
  ) {
    return (
      <ProjectEvaluatorSlideoverError
        title="Cannot edit evaluator"
        message={`“${evaluator.name}” is a built-in evaluator, which cannot be edited. Copy it to author your own version.`}
        onOpenChange={onOpenChange}
      />
    );
  }
  return (
    <EditProjectEvaluatorSlideover
      isOpen
      onOpenChange={onOpenChange}
      evaluator={evaluator}
      sandboxConfigs={sandboxConfigs}
    />
  );
}
