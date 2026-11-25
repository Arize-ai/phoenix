import type { ReactNode } from "react";

import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import {
  ProjectCodeEvaluatorFormSections,
  ProjectEvaluatorInputMappingDock,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import {
  ProjectEvaluatorScopePanel,
  type ProjectEvaluatorInlineCode,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import {
  type ProjectEvaluatorSubmitGateInput,
  useProjectEvaluatorSubmitGate,
} from "@phoenix/pages/project/evaluators/projectEvaluatorSubmitGate";
import {
  type ProjectEvaluatorScope,
  toEvaluatorRecordKind,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export const ProjectCodeEvaluatorDialogContent = ({
  title,
  projectId,
  evaluatorId,
  evaluatorName,
  variables,
  requiredVariables,
  codeDefinition,
  inlineCode,
  scope,
  onScopeChange,
  submitGate,
  onFilterValidityChange,
  onFieldChange,
  onSubmit,
  isSubmitting,
  error,
  mode = "create",
  canDescribeInputs,
}: {
  title: string;
  projectId: string;
  evaluatorId: string;
  evaluatorName: string;
  /** The evaluator's declared parameters, extracted from its source code. */
  variables: string[];
  /** The evaluator parameters that must resolve before execution. */
  requiredVariables: string[];
  codeDefinition?: ReactNode;
  inlineCode?: ProjectEvaluatorInlineCode;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  /**
   * What the save button waits on. The parent holds it, so the submit it
   * hands PXI is held by the same gate.
   */
  submitGate: ProjectEvaluatorSubmitGateInput;
  onFilterValidityChange: (isValid: boolean) => void;
  /** Fires when the name or description changes, so stale error banners can be cleared. */
  onFieldChange?: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error?: string;
  mode?: "create" | "update";
  /**
   * Whether this form saves the evaluator's definition, so input descriptions
   * written here persist. Attaching an existing evaluator does not.
   */
  canDescribeInputs?: boolean;
}) => {
  const gate = useProjectEvaluatorSubmitGate(submitGate);
  return (
    <EvaluatorFormDialogContent
      title={title}
      submitLabel={mode === "create" ? "Attach evaluator" : "Save changes"}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      isSubmitDisabled={gate.isSubmitDisabled}
      submitHint={gate.submitHint}
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
        <ProjectCodeEvaluatorFormSections
          projectId={projectId}
          scope={scope}
          onScopeChange={onScopeChange}
          onFilterValidityChange={onFilterValidityChange}
          isTargetDisabled={mode === "update"}
          codeEvaluatorName={evaluatorName}
          codeDefinition={codeDefinition}
          onFieldChange={onFieldChange}
        />
      }
      leftDock={
        <ProjectEvaluatorInputMappingDock
          recordKind={toEvaluatorRecordKind(scope.targetType)}
          requiredVariables={requiredVariables}
          evaluatorKind="code"
          canDescribeInputs={canDescribeInputs}
        />
      }
      right={
        <ProjectEvaluatorScopePanel
          projectId={projectId}
          scope={scope}
          codeEvaluatorId={inlineCode ? undefined : evaluatorId}
          inlineCode={inlineCode}
          requiredVariables={requiredVariables}
        />
      }
    />
  );
};
