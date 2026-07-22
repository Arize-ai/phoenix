import { css } from "@emotion/react";
import type { Key } from "react-aria-components";

import { Alert, Button } from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { EvaluatorForm } from "@phoenix/components/evaluators/EvaluatorForm";
import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { ProjectEvaluatorFormSections } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import { ProjectEvaluatorTestPanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTestPanel";
import type { ProjectEvaluatorScope } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export const ProjectCodeEvaluatorDialogContent = ({
  projectId,
  evaluatorId,
  evaluatorName,
  scope,
  onScopeChange,
  expandedKeys,
  onExpandedChange,
  onSubmit,
  isSubmitting,
  error,
  mode = "create",
}: {
  projectId: string;
  evaluatorId: string;
  evaluatorName: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  expandedKeys: Set<Key>;
  onExpandedChange: (keys: Set<Key>) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error?: string;
  mode?: "create" | "update";
}) => {
  const inputMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping
  );
  const variables = Array.from(
    new Set([
      ...Object.keys(inputMapping.pathMapping),
      ...Object.keys(inputMapping.literalMapping),
    ])
  );
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {mode === "create"
            ? "Create project evaluator"
            : "Edit project evaluator"}
        </DialogTitle>
        <DialogTitleExtra>
          <Button slot="close" isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isPending={isSubmitting}
            isDisabled={isSubmitting}
            onPress={onSubmit}
          >
            {mode === "create" ? "Attach evaluator" : "Save changes"}
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
          gap: var(--global-dimension-size-100);
          overflow: auto;
        `}
      >
        {error ? (
          <Alert variant="danger" title="Failed to attach evaluator">
            {error}
          </Alert>
        ) : null}
        <EvaluatorInputVariablesProvider variables={variables}>
          <EvaluatorForm
            left={
              <ProjectEvaluatorFormSections
                scope={scope}
                onScopeChange={onScopeChange}
                expandedKeys={expandedKeys}
                onExpandedChange={onExpandedChange}
                definitionKind="code"
                codeEvaluatorName={evaluatorName}
              />
            }
            right={
              <ProjectEvaluatorTestPanel
                projectId={projectId}
                filterCondition={scope.filterCondition}
                codeEvaluatorId={evaluatorId}
              />
            }
          />
        </EvaluatorInputVariablesProvider>
      </fieldset>
    </DialogContent>
  );
};
