import type { ReactNode } from "react";

import { Flex } from "@phoenix/components";
import { CodeEvaluatorAnnotationSection } from "@phoenix/components/evaluators/CodeEvaluatorAnnotationSection";
import {
  CodeEvaluatorLanguageField,
  CodeEvaluatorSandboxField,
  type SandboxConfigOption,
} from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import { CodeEvaluatorSourceEditor } from "@phoenix/components/evaluators/CodeEvaluatorSourceEditor";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import type { CodeEvaluatorLanguage } from "@phoenix/types";

/**
 * The "Evaluator Code" section of a code evaluator form: the section header
 * hosting the compact language and sandbox pickers, the source editor, and
 * the output annotation config.
 */
export const CodeAuthoringFields = ({
  language,
  onLanguageChange,
  sandboxConfigs,
  selectedSandboxConfigId,
  onSandboxChange,
  sourceCode,
  onSourceCodeChange,
  isLanguageDisabled = false,
  isSandboxRequired = true,
  onFieldChange,
}: {
  language: CodeEvaluatorLanguage;
  onLanguageChange: (language: CodeEvaluatorLanguage) => void;
  sandboxConfigs: SandboxConfigOption[];
  selectedSandboxConfigId: string | null;
  onSandboxChange: (sandboxConfigId: string | null) => void;
  sourceCode: string;
  onSourceCodeChange: (sourceCode: string) => void;
  isLanguageDisabled?: boolean;
  isSandboxRequired?: boolean;
  onFieldChange?: () => void;
}): ReactNode => (
  <Flex direction="column" gap="size-200">
    <EvaluatorSectionHeader
      title="Evaluator Code"
      description="Define the source code for your evaluator."
      extra={
        <Flex direction="row" gap="size-100" alignItems="center">
          <CodeEvaluatorLanguageField
            language={language}
            onChange={(nextLanguage) => {
              onFieldChange?.();
              onLanguageChange(nextLanguage);
            }}
            isDisabled={isLanguageDisabled}
            isRequired
            hideLabel
          />
          <CodeEvaluatorSandboxField
            sandboxConfigs={sandboxConfigs}
            language={language}
            selectedSandboxConfigId={selectedSandboxConfigId}
            onSelectionChange={(sandboxConfigId) => {
              onFieldChange?.();
              onSandboxChange(sandboxConfigId);
            }}
            isRequired={isSandboxRequired}
            hideLabel
          />
        </Flex>
      }
    />
    <CodeEvaluatorSourceEditor
      language={language}
      sourceCode={sourceCode}
      onChange={(nextSourceCode) => {
        onFieldChange?.();
        onSourceCodeChange(nextSourceCode);
      }}
    />
    <CodeEvaluatorAnnotationSection onChange={onFieldChange} />
  </Flex>
);
