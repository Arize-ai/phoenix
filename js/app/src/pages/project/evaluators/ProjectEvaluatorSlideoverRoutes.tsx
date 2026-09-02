import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay";
import { useLocation, useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import type { projectEvaluatorDetailsQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorDetailsQuery.graphql";
import type { projectEvaluatorTemplatesQuery as ProjectEvaluatorTemplatesQueryType } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";
import { CreateProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";
import {
  EditProjectEvaluatorSlideover,
  useProjectEvaluator,
} from "@phoenix/pages/project/evaluators/EditProjectEvaluatorSlideover";
import {
  buildAttachCodeCreationMode,
  buildCopyLlmCreationMode,
  projectEvaluatorDetailsQueryNode,
  readProjectEvaluatorDetails,
  UNSUPPORTED_PROMPT_TEMPLATE_ERROR,
} from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";
import { ProjectEvaluatorSlideoverError } from "@phoenix/pages/project/evaluators/ProjectEvaluatorSlideoverError";
import {
  buildTemplateCreationMode,
  projectEvaluatorTemplatesQuery,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTemplates";

/**
 * Closes the slideover by leaving its nested route for its parent page.
 * Replaces rather than pushes, so a dismissed slideover does not sit one step
 * back in history waiting to be reopened. The current search is retained so
 * the parent page restores the view state the slideover was opened over.
 */
function useCloseSlideover() {
  const navigate = useNavigate();
  const { search } = useLocation();
  return (isOpen: boolean) => {
    if (!isOpen) {
      navigate(
        { pathname: "..", search },
        { relative: "route", replace: true }
      );
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
  return readProjectEvaluatorDetails(data.evaluator);
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

export function NewGalleryLlmFromTemplateProjectEvaluatorPage() {
  const projectId = useRouteProjectId();
  const { templateName } = useParams();
  invariant(templateName, "templateName is required");
  const onOpenChange = useCloseSlideover();
  const data = useLazyLoadQuery<ProjectEvaluatorTemplatesQueryType>(
    projectEvaluatorTemplatesQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );
  const template = data.evaluatorGalleryConfigs.find(
    (config) => config.name === templateName
  );
  if (!template) {
    return (
      <ProjectEvaluatorSlideoverError
        title="Cannot create evaluator"
        message="This link does not name an evaluator template."
        onOpenChange={onOpenChange}
      />
    );
  }
  return (
    <CreateProjectEvaluatorSlideover
      isOpen
      onOpenChange={onOpenChange}
      projectId={projectId}
      creationMode={buildTemplateCreationMode(template)}
    />
  );
}

export function CopyLlmProjectEvaluatorPage() {
  const projectId = useRouteProjectId();
  const onOpenChange = useCloseSlideover();
  const evaluator = useSourceEvaluator();
  // Memoized: this walks every prompt message and mints fresh message ids, and
  // the page re-renders under the open slideover (e.g. as the toolbar filter
  // changes). A new object each time would rebuild the evaluator store too.
  const built = useMemo(
    () =>
      evaluator?.__typename === "LLMEvaluator"
        ? buildCopyLlmCreationMode(evaluator)
        : null,
    [evaluator]
  );
  const title = "Cannot copy evaluator";
  if (!built) {
    return (
      <ProjectEvaluatorSlideoverError
        title={title}
        message="This link does not name an LLM evaluator."
        onOpenChange={onOpenChange}
      />
    );
  }
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
  // Memoized for the same reason as the copy route: it parses the evaluator's
  // source twice to extract its variables.
  const creationMode = useMemo(
    () =>
      evaluator?.__typename === "CodeEvaluator"
        ? buildAttachCodeCreationMode(evaluator)
        : null,
    [evaluator]
  );
  if (!creationMode) {
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
      creationMode={creationMode}
    />
  );
}

export function EditProjectEvaluatorPage() {
  const { projectEvaluatorId } = useParams();
  invariant(projectEvaluatorId, "projectEvaluatorId is required");
  const onOpenChange = useCloseSlideover();
  const { evaluator, sandboxConfigs } = useProjectEvaluator(projectEvaluatorId);
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
