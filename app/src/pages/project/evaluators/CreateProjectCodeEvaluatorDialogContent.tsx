import { type ReactNode, useMemo, useState } from "react";
import type { Key } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import { Alert, Flex, LinkButton } from "@phoenix/components";
import {
  CodeEvaluatorLanguageField,
  CodeEvaluatorSandboxField,
  mapSandboxConfigOptions,
} from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import {
  getAllGeneratedSources,
  getDefaultCodeEvaluatorSource,
  extractCodeEvaluatorVariables,
} from "@phoenix/components/evaluators/codeEvaluatorUtils";
import {
  CodeEvaluatorAnnotationSection,
  CodeEvaluatorSourceEditor,
} from "@phoenix/components/evaluators/EditCodeEvaluatorDialogContent";
import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { CodeEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/CodeEvaluatorInputVariablesProvider";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import {
  buildOutputConfigsInput,
  getOutputConfigValidationErrors,
} from "@phoenix/components/evaluators/utils";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import type { CreateProjectCodeEvaluatorDialogContentMutation } from "@phoenix/pages/project/evaluators/__generated__/CreateProjectCodeEvaluatorDialogContentMutation.graphql";
import type { CreateProjectCodeEvaluatorDialogContentQuery } from "@phoenix/pages/project/evaluators/__generated__/CreateProjectCodeEvaluatorDialogContentQuery.graphql";
import { ProjectEvaluatorFormSections } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import { ProjectEvaluatorTestPanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTestPanel";
import {
  toProjectEvaluatorGraphQLTarget,
  toProjectEvaluatorSamplingFraction,
  type ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { CodeEvaluatorLanguage } from "@phoenix/types";

/**
 * Authors a brand-new code evaluator and binds it to the project in a single
 * `createProjectCodeEvaluator` mutation. Reuses the scope-first
 * {@link ProjectEvaluatorFormSections} on the left (with code-authoring fields
 * in the definition section) and the shared {@link ProjectEvaluatorTestPanel}
 * on the right, previewing the unsaved source through the inline-code path.
 */
export const CreateProjectCodeEvaluatorDialogContent = ({
  projectId,
  scope,
  onScopeChange,
  expandedKeys,
  onExpandedChange,
  updateConnectionIds,
  onSuccess,
}: {
  projectId: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  expandedKeys: Set<Key>;
  onExpandedChange: (keys: Set<Key>) => void;
  updateConnectionIds?: string[];
  onSuccess: () => void;
}) => {
  const store = useEvaluatorStoreInstance();
  const data = useLazyLoadQuery<CreateProjectCodeEvaluatorDialogContentQuery>(
    graphql`
      query CreateProjectCodeEvaluatorDialogContentQuery {
        sandboxProviders {
          backendType
          supportedLanguages
          enabled
          configs {
            id
            name
            description
            language
            timeout
            config {
              envVars {
                name
                secretKey
              }
              internetAccess {
                mode
              }
              dependencies {
                packages
              }
            }
          }
        }
        sandboxBackends {
          backendType
          status
          supportsEnvVars
          internetAccess
          supportsDependencies
        }
      }
    `,
    {}
  );
  const sandboxConfigs = mapSandboxConfigOptions(
    data.sandboxProviders,
    data.sandboxBackends
  );

  const [language, setLanguage] = useState<CodeEvaluatorLanguage>("PYTHON");
  const [sourceCode, setSourceCode] = useState(() =>
    getDefaultCodeEvaluatorSource("PYTHON")
  );
  const [sandboxConfigId, setSandboxConfigId] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [validationMessage, setValidationMessage] = useState<
    string | undefined
  >();
  const [isFilterValid, setIsFilterValid] = useState(true);

  const variables = useMemo(
    () => extractCodeEvaluatorVariables({ language, sourceCode }),
    [language, sourceCode]
  );

  // A sandbox is only valid for the selected language; drop the selection when
  // it no longer matches so create validation and preview stay consistent.
  const selectedSandboxConfigId = sandboxConfigs.some(
    (config) => config.id === sandboxConfigId && config.language === language
  )
    ? sandboxConfigId
    : null;
  const hasNoSandboxConfigs = sandboxConfigs.length === 0;

  const [createEvaluator, isCreating] =
    useMutation<CreateProjectCodeEvaluatorDialogContentMutation>(graphql`
      mutation CreateProjectCodeEvaluatorDialogContentMutation(
        $input: CreateProjectCodeEvaluatorInput!
        $connectionIds: [ID!]!
      ) {
        createProjectCodeEvaluator(input: $input) {
          evaluator
            @appendNode(
              connections: $connectionIds
              edgeTypeName: "ProjectEvaluatorEdge"
            ) {
            id
            name
            evaluationTarget
            filterCondition
            samplingRate
            enabled
            evaluator {
              kind
            }
          }
        }
      }
    `);

  const handleLanguageChange = (nextLanguage: CodeEvaluatorLanguage) => {
    // Only swap the source when it is still an untouched generated default,
    // never over user-authored code.
    if (getAllGeneratedSources(language).includes(sourceCode)) {
      setSourceCode(getDefaultCodeEvaluatorSource(nextLanguage));
    }
    setLanguage(nextLanguage);
  };

  const onSubmit = () => {
    setError(undefined);
    const state = store.getState();
    const name = state.evaluator.globalName.trim();
    const outputConfigErrors = getOutputConfigValidationErrors(
      state.outputConfigs
    );
    const nextValidationMessage = !name
      ? "Evaluator name is required."
      : sourceCode.trim().length === 0
        ? "Source code is required."
        : selectedSandboxConfigId == null
          ? "Please select a sandbox configuration."
          : outputConfigErrors.length
            ? outputConfigErrors.join("\n")
            : undefined;
    if (nextValidationMessage || selectedSandboxConfigId == null) {
      setValidationMessage(
        nextValidationMessage ?? "Please select a sandbox configuration."
      );
      return;
    }
    setValidationMessage(undefined);
    createEvaluator({
      variables: {
        input: {
          projectId,
          name,
          sourceCode,
          language,
          sandboxConfigId: selectedSandboxConfigId,
          evaluatorInputMapping: state.evaluator.inputMapping,
          samplingRate: toProjectEvaluatorSamplingFraction(
            scope.samplingRatePercent
          ),
          evaluationTarget: toProjectEvaluatorGraphQLTarget(scope.targetType),
          description: state.evaluator.description.trim() || null,
          outputConfigs: buildOutputConfigsInput(state.outputConfigs),
          // Per-project mapping is null on create so the evaluator's own
          // mapping is inherited.
          inputMapping: null,
          filterCondition: scope.filterCondition,
          enabled: true,
        },
        connectionIds: updateConnectionIds ?? [],
      },
      onCompleted: (_response, errors) => {
        if (errors?.length) {
          setError(errors.map(({ message }) => message).join("\n"));
          return;
        }
        onSuccess();
      },
      onError: (mutationError) => setError(mutationError.message),
    });
  };

  return (
    <EvaluatorFormDialogContent
      title="Create project evaluator"
      submitLabel="Create"
      onSubmit={onSubmit}
      isSubmitting={isCreating}
      isSubmitDisabled={!isFilterValid}
      error={error}
      errorTitle="Failed to create evaluator"
      contentGap="var(--global-dimension-size-100)"
      banner={
        <>
          {hasNoSandboxConfigs ? (
            <Alert
              variant="warning"
              banner
              extra={
                <LinkButton size="S" to="/settings/sandboxes">
                  Configure a sandbox
                </LinkButton>
              }
            >
              No sandboxes configured. Configure a sandbox before creating a
              code evaluator.
            </Alert>
          ) : null}
          {validationMessage ? (
            <Alert
              variant="danger"
              title="Invalid code evaluator configuration"
            >
              {validationMessage}
            </Alert>
          ) : null}
        </>
      }
      renderInputVariables={(form) => (
        <CodeEvaluatorInputVariablesProvider variables={variables}>
          {form}
        </CodeEvaluatorInputVariablesProvider>
      )}
      left={
        <ProjectEvaluatorFormSections
          projectId={projectId}
          scope={scope}
          onScopeChange={onScopeChange}
          expandedKeys={expandedKeys}
          onExpandedChange={onExpandedChange}
          definitionKind="newCode"
          onFilterValidityChange={setIsFilterValid}
          codeDefinition={
            <CodeAuthoringFields
              language={language}
              onLanguageChange={handleLanguageChange}
              sandboxConfigs={sandboxConfigs}
              selectedSandboxConfigId={selectedSandboxConfigId}
              onSandboxChange={setSandboxConfigId}
              sourceCode={sourceCode}
              onSourceCodeChange={setSourceCode}
            />
          }
        />
      }
      right={
        <ProjectEvaluatorTestPanel
          projectId={projectId}
          filterCondition={scope.filterCondition}
          inlineCode={{
            language,
            sourceCode,
            sandboxConfigId: selectedSandboxConfigId,
          }}
        />
      }
    />
  );
};

const CodeAuthoringFields = ({
  language,
  onLanguageChange,
  sandboxConfigs,
  selectedSandboxConfigId,
  onSandboxChange,
  sourceCode,
  onSourceCodeChange,
}: {
  language: CodeEvaluatorLanguage;
  onLanguageChange: (language: CodeEvaluatorLanguage) => void;
  sandboxConfigs: Parameters<
    typeof CodeEvaluatorSandboxField
  >[0]["sandboxConfigs"];
  selectedSandboxConfigId: string | null;
  onSandboxChange: (sandboxConfigId: string | null) => void;
  sourceCode: string;
  onSourceCodeChange: (sourceCode: string) => void;
}): ReactNode => (
  <Flex direction="column" gap="size-200">
    <EvaluatorNameAndDescriptionFields />
    <Flex direction="row" gap="size-200" alignItems="start">
      <CodeEvaluatorLanguageField
        language={language}
        onChange={onLanguageChange}
        isRequired
      />
      <CodeEvaluatorSandboxField
        sandboxConfigs={sandboxConfigs}
        language={language}
        selectedSandboxConfigId={selectedSandboxConfigId}
        onSelectionChange={onSandboxChange}
        isRequired
      />
    </Flex>
    <CodeEvaluatorSourceEditor
      language={language}
      sourceCode={sourceCode}
      onChange={onSourceCodeChange}
    />
    <CodeEvaluatorAnnotationSection />
  </Flex>
);
