import { css } from "@emotion/react";
import { useState } from "react";
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
import { ProjectEvaluatorFormSections } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import { ProjectEvaluatorTestPanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTestPanel";
import type { ProjectEvaluatorScope } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export const ProjectCodeEvaluatorDialogContent = ({
  projectId,
  evaluatorId,
  evaluatorName,
  variables,
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
  /** The evaluator's declared parameters, extracted from its source code. */
  variables: string[];
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  expandedKeys: Set<Key>;
  onExpandedChange: (keys: Set<Key>) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error?: string;
  mode?: "create" | "update";
}) => {
  const [isFilterValid, setIsFilterValid] = useState(true);
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
            isDisabled={isSubmitting || !isFilterValid}
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
                projectId={projectId}
                scope={scope}
                onScopeChange={onScopeChange}
                expandedKeys={expandedKeys}
                onExpandedChange={onExpandedChange}
                definitionKind="code"
                codeEvaluatorName={evaluatorName}
                onFilterValidityChange={setIsFilterValid}
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
