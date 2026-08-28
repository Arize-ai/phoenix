import { type ReactNode, useState } from "react";
import {
  graphql,
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from "react-relay";

import { Alert, Flex, LinkButton } from "@phoenix/components";
import { useTimeRange } from "@phoenix/components/datetime";
import {
  CodeEvaluatorLanguageField,
  CodeEvaluatorSandboxField,
  mapSandboxConfigOptions,
} from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import {
  getAllGeneratedSources,
  getDefaultCodeEvaluatorSource,
  extractCodeEvaluatorVariables,
  extractRequiredCodeEvaluatorVariables,
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
import { ProjectCodeEvaluatorFormSections } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import { ProjectEvaluatorScopePanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import {
  toEvaluationDelayInput,
  type ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { refetchProjectEvaluators } from "@phoenix/pages/project/evaluators/refetchProjectEvaluators";
import type { CodeEvaluatorLanguage } from "@phoenix/types";

export const CreateProjectCodeEvaluatorDialogContent = ({
  title,
  projectId,
  scope,
  onScopeChange,
  onSuccess,
}: {
  title: string;
  projectId: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  onSuccess: () => void;
}) => {
  const store = useEvaluatorStoreInstance();
  const environment = useRelayEnvironment();
  const { timeRangeISOStrings } = useTimeRange();
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

  const variables = extractCodeEvaluatorVariables({ language, sourceCode });
  const requiredVariables = extractRequiredCodeEvaluatorVariables({
    language,
    sourceCode,
  });

  // A sandbox config is only valid for its own language.
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
      ) {
        createProjectCodeEvaluator(input: $input) {
          evaluator {
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
          samplingRate: scope.samplingRate,
          evaluationTarget: scope.targetType,
          description: state.evaluator.description.trim() || null,
          outputConfigs: buildOutputConfigsInput(state.outputConfigs),
          // A null per-project mapping inherits the evaluator's own mapping.
          inputMapping: null,
          filterCondition: scope.filterCondition,
          ...toEvaluationDelayInput(scope),
          enabled: true,
        },
      },
      onCompleted: (_response, errors) => {
        if (errors?.length) {
          setError(errors.map(({ message }) => message).join("\n"));
          return;
        }
        void refetchProjectEvaluators({
          environment,
          projectId,
          timeRange: timeRangeISOStrings,
        })
          .then(onSuccess)
          .catch((refetchError: unknown) =>
            setError(
              refetchError instanceof Error
                ? refetchError.message
                : "Unable to refresh project evaluators"
            )
          );
      },
      onError: (mutationError) => setError(mutationError.message),
    });
  };

  return (
    <EvaluatorFormDialogContent
      title={title}
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
        <ProjectCodeEvaluatorFormSections
          codeDefinition={
            <CodeAuthoringFields
              language={language}
              onLanguageChange={handleLanguageChange}
              sandboxConfigs={sandboxConfigs}
              selectedSandboxConfigId={selectedSandboxConfigId}
              onSandboxChange={setSandboxConfigId}
              sourceCode={sourceCode}
              onSourceCodeChange={setSourceCode}
              onFieldChange={() => setValidationMessage(undefined)}
            />
          }
        />
      }
      right={
        <ProjectEvaluatorScopePanel
          projectId={projectId}
          scope={scope}
          onScopeChange={onScopeChange}
          onFilterValidityChange={setIsFilterValid}
          inlineCode={{
            language,
            sourceCode,
            sandboxConfigId: selectedSandboxConfigId,
          }}
          requiredVariables={requiredVariables}
        />
      }
    />
  );
};

export const CodeAuthoringFields = ({
  language,
  onLanguageChange,
  sandboxConfigs,
  selectedSandboxConfigId,
  onSandboxChange,
  sourceCode,
  onSourceCodeChange,
  isLanguageDisabled = false,
  onFieldChange,
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
  isLanguageDisabled?: boolean;
  onFieldChange?: () => void;
}): ReactNode => (
  <Flex direction="column" gap="size-200">
    <EvaluatorNameAndDescriptionFields onValueChange={onFieldChange} />
    <Flex direction="row" gap="size-200" alignItems="start">
      <CodeEvaluatorLanguageField
        language={language}
        onChange={(nextLanguage) => {
          onFieldChange?.();
          onLanguageChange(nextLanguage);
        }}
        isDisabled={isLanguageDisabled}
        isRequired
      />
      <CodeEvaluatorSandboxField
        sandboxConfigs={sandboxConfigs}
        language={language}
        selectedSandboxConfigId={selectedSandboxConfigId}
        onSelectionChange={(sandboxConfigId) => {
          onFieldChange?.();
          onSandboxChange(sandboxConfigId);
        }}
        isRequired
      />
    </Flex>
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
