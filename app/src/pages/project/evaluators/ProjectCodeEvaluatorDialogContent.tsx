import { useState } from "react";
import type { Key } from "react-aria-components";

import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
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
    <EvaluatorFormDialogContent
      title={
        mode === "create"
          ? "Create project evaluator"
          : "Edit project evaluator"
      }
      submitLabel={mode === "create" ? "Attach evaluator" : "Save changes"}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      isSubmitDisabled={!isFilterValid}
      error={error}
      errorTitle="Failed to attach evaluator"
      contentGap="var(--global-dimension-size-100)"
      renderInputVariables={(form) => (
        <EvaluatorInputVariablesProvider variables={variables}>
          {form}
        </EvaluatorInputVariablesProvider>
      )}
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
  );
};
