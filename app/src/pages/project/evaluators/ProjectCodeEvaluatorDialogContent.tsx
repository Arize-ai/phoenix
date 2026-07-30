import { useState } from "react";
import type { ReactNode } from "react";

import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { ProjectEvaluatorFormSections } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import {
  ProjectEvaluatorScopePanel,
  type ProjectEvaluatorInlineCode,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import type { ProjectEvaluatorScope } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export const ProjectCodeEvaluatorDialogContent = ({
  projectId,
  evaluatorId,
  evaluatorName,
  variables,
  codeDefinition,
  inlineCode,
  scope,
  onScopeChange,
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
  codeDefinition?: ReactNode;
  inlineCode?: ProjectEvaluatorInlineCode;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
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
      errorTitle={
        mode === "create"
          ? "Failed to attach evaluator"
          : "Failed to update evaluator"
      }
      contentGap="var(--global-dimension-size-100)"
      renderInputVariables={(form) => (
        <EvaluatorInputVariablesProvider variables={variables}>
          {form}
        </EvaluatorInputVariablesProvider>
      )}
      left={
        <ProjectEvaluatorFormSections
          definitionKind="code"
          codeEvaluatorName={evaluatorName}
          codeDefinition={codeDefinition}
        />
      }
      right={
        <ProjectEvaluatorScopePanel
          projectId={projectId}
          scope={scope}
          onScopeChange={onScopeChange}
          onFilterValidityChange={setIsFilterValid}
          codeEvaluatorId={inlineCode ? undefined : evaluatorId}
          inlineCode={inlineCode}
        />
      }
    />
  );
};
