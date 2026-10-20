/**
 * Rehydrates playground state from an experiment's task config.
 *
 * Fetches the experiment's ExperimentJob.taskConfig via GraphQL and
 * maps it to PlaygroundProps that can be passed to <Playground>.
 */

import { fetchQuery, graphql } from "relay-runtime";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import {
  createDecisionTaskInstance,
  DEFAULT_INSTANCE_PARAMS,
  DEFAULT_MAX_CONCURRENCY,
  generateInstanceId,
} from "@phoenix/store/playground/playgroundStore";
import {
  DEFAULT_TEMPLATE_VARIABLES_PATH,
  DEFAULT_TEMPLATE_VARIABLES_PATH_BY_ROLE,
  type TemplateVariablesPathByRole,
} from "@phoenix/store/playground/templateVariablesPath";
import type {
  ModelConfig,
  PlaygroundInstance,
  PlaygroundProps,
} from "@phoenix/store/playground/types";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { experimentRehydrationQuery } from "./__generated__/experimentRehydrationQuery.graphql";
import { toSavedDecisionVersion } from "./fetchPlaygroundDecision";
import { buildPlaygroundInstanceFieldsFromPromptConfig } from "./promptConfigToPlaygroundInstance";
import { savedDecisionVersionToDraft } from "./savedDecisionUtils";

import "@phoenix/pages/playground/PromptInvocationParametersReadableFragment";

const EXPERIMENT_REHYDRATION_QUERY = graphql`
  query experimentRehydrationQuery($experimentId: ID!) {
    node(id: $experimentId) {
      ... on Experiment {
        dataset {
          id
        }
        job {
          maxConcurrency
          datasetEvaluators {
            edges {
              node {
                id
              }
            }
          }
          taskConfig {
            __typename
            ... on DecisionTaskConfig {
              modelProvider
              modelName
              baseUrl
              customProvider {
                id
                name
              }
              inputValuesPath
              inputs {
                name
              }
              state {
                __typename
                ... on DecisionObjectState {
                  object
                }
                ... on DecisionInputState {
                  input
                }
                ... on DecisionTextState {
                  template
                  templateFormat
                }
              }
              questions {
                __typename
                ... on DecisionPredicateQuestion {
                  name
                  instructions
                  criteria {
                    true
                    false
                  }
                }
                ... on DecisionChoiceQuestion {
                  name
                  instructions
                  choices {
                    value
                    description
                  }
                }
                ... on DecisionScaleQuestion {
                  name
                  instructions
                  levels {
                    label
                    description
                  }
                }
              }
            }
            ... on PromptTaskConfig {
              prompt {
                templateType
                templateFormat
                template {
                  __typename
                  ... on PromptChatTemplate {
                    messages {
                      role
                      content {
                        __typename
                        ... on TextContentPart {
                          text {
                            text
                          }
                        }
                        ... on ToolCallContentPart {
                          toolCall {
                            toolCallId
                            toolCall {
                              name
                              arguments
                            }
                          }
                        }
                        ... on ToolResultContentPart {
                          toolResult {
                            toolCallId
                            result
                          }
                        }
                      }
                    }
                  }
                }
                tools {
                  tools {
                    __typename
                    ... on PromptToolFunction {
                      function {
                        name
                        description
                        parameters
                        strict
                      }
                    }
                    ... on PromptToolRaw {
                      raw
                    }
                  }
                  toolChoice {
                    type
                    functionName
                  }
                  disableParallelToolCalls
                }
                responseFormat {
                  jsonSchema {
                    name
                    description
                    schema
                    strict
                  }
                }
                invocationParameters {
                  ...PromptInvocationParametersReadableFragment
                }
                modelProvider
                modelName
              }
              connection {
                __typename
                ... on OpenAIConnectionConfig {
                  baseUrl
                  openaiApiType
                }
                ... on AzureOpenAIConnectionConfig {
                  azureEndpoint
                  openaiApiType
                }
                ... on AnthropicConnectionConfig {
                  baseUrl
                }
                ... on AWSBedrockConnectionConfig {
                  regionName
                  endpointUrl
                }
                ... on GoogleGenAIConnectionConfig {
                  baseUrl
                }
              }
              customProvider {
                id
                name
              }
              playgroundConfig {
                templateVariablesPath
                appendedMessagesPath
              }
              streamModelOutput
            }
          }
        }
      }
    }
  }
`;

export type ExperimentRehydrationResult = {
  playgroundProps: Partial<PlaygroundProps>;
  datasetId: string | null;
  stateByDatasetId: Record<
    string,
    {
      templateVariablesPathByRole: TemplateVariablesPathByRole;
      appendedMessagesPath?: string | null;
      maxConcurrency: number;
    }
  >;
  selectedDatasetEvaluatorIds: string[];
};

type TaskConfig = Extract<
  NonNullable<
    NonNullable<
      experimentRehydrationQuery["response"]["node"]["job"]
    >["taskConfig"]
  >,
  { __typename: "PromptTaskConfig" }
>;

function taskConfigToPlaygroundProps(
  taskConfig: TaskConfig,
  maxConcurrency: number,
  datasetId: string | null,
  selectedDatasetEvaluatorIds: string[]
): ExperimentRehydrationResult {
  const prompt = taskConfig.prompt;
  const provider = prompt.modelProvider as ModelProvider;

  // --- Custom Provider ---
  const customProvider = taskConfig.customProvider
    ? {
        id: taskConfig.customProvider.id,
        name: taskConfig.customProvider.name,
      }
    : null;

  // --- Connection Config → model fields ---
  const conn = taskConfig.connection;
  const connectionFields: Partial<ModelConfig> = {};
  if (conn) {
    switch (conn.__typename) {
      case "OpenAIConnectionConfig":
        connectionFields.baseUrl = conn.baseUrl;
        connectionFields.openaiApiType = conn.openaiApiType;
        break;
      case "AzureOpenAIConnectionConfig":
        connectionFields.endpoint = conn.azureEndpoint;
        connectionFields.openaiApiType = conn.openaiApiType;
        break;
      case "AnthropicConnectionConfig":
        connectionFields.baseUrl = conn.baseUrl;
        break;
      case "AWSBedrockConnectionConfig":
        connectionFields.region = conn.regionName;
        connectionFields.endpoint = conn.endpointUrl;
        break;
      case "GoogleGenAIConnectionConfig":
        connectionFields.baseUrl = conn.baseUrl;
        break;
    }
  }

  const instanceFields = buildPlaygroundInstanceFieldsFromPromptConfig({
    provider,
    modelName: prompt.modelName,
    template: prompt.template,
    tools: prompt.tools,
    invocationParametersRef: prompt.invocationParameters,
    responseFormat: prompt.responseFormat,
    customProvider,
    connectionFields,
  });

  const defaults = DEFAULT_INSTANCE_PARAMS();
  const instance: PlaygroundInstance = {
    ...defaults,
    id: generateInstanceId(),
    selectedRepetitionNumber: 1,
    model: { ...defaults.model, ...instanceFields.model },
    template: instanceFields.template,
    tools: instanceFields.tools,
    toolChoice: instanceFields.toolChoice,
  };

  // An experiment's playground config belongs to its prompt task; the
  // judging role keeps its default.
  const templateVariablesPathByRole: TemplateVariablesPathByRole = {
    ...DEFAULT_TEMPLATE_VARIABLES_PATH_BY_ROLE,
    tested:
      taskConfig.playgroundConfig?.templateVariablesPath ??
      DEFAULT_TEMPLATE_VARIABLES_PATH,
  };
  const appendedMessagesPath =
    taskConfig.playgroundConfig?.appendedMessagesPath ?? null;

  const stateByDatasetId: ExperimentRehydrationResult["stateByDatasetId"] =
    datasetId
      ? {
          [datasetId]: {
            templateVariablesPathByRole,
            appendedMessagesPath,
            maxConcurrency,
          },
        }
      : {};

  return {
    playgroundProps: {
      instances: [instance],
      templateFormat:
        prompt.templateFormat as PlaygroundProps["templateFormat"],
    },
    datasetId,
    stateByDatasetId,
    selectedDatasetEvaluatorIds,
  };
}

export async function fetchExperimentPlaygroundProps(
  experimentId: string
): Promise<ExperimentRehydrationResult | null> {
  const data = await fetchQuery<experimentRehydrationQuery>(
    RelayEnvironment,
    EXPERIMENT_REHYDRATION_QUERY,
    { experimentId }
  ).toPromise();

  if (!data?.node) return null;

  const node = data.node;
  const job = node.job;
  const taskConfig = job?.taskConfig;
  if (!job || !taskConfig) return null;

  const selectedDatasetEvaluatorIds = job.datasetEvaluators.edges.map(
    (edge) => edge.node.id
  );

  if (taskConfig.__typename === "DecisionTaskConfig") {
    return decisionTaskConfigToPlaygroundProps({
      taskConfig,
      maxConcurrency: job.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
      datasetId: node.dataset?.id ?? null,
      selectedDatasetEvaluatorIds,
    });
  }
  if (taskConfig.__typename !== "PromptTaskConfig") return null;
  return taskConfigToPlaygroundProps(
    taskConfig,
    job.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
    node.dataset?.id ?? null,
    selectedDatasetEvaluatorIds
  );
}

/** Rebuild a fixed-question decision task from its frozen experiment configuration. */
export function decisionTaskConfigToPlaygroundProps({
  taskConfig,
  maxConcurrency,
  datasetId,
  selectedDatasetEvaluatorIds,
}: {
  taskConfig: Extract<
    NonNullable<
      NonNullable<
        experimentRehydrationQuery["response"]["node"]["job"]
      >["taskConfig"]
    >,
    { __typename: "DecisionTaskConfig" }
  >;
  maxConcurrency: number;
  datasetId: string | null;
  selectedDatasetEvaluatorIds: string[];
}): ExperimentRehydrationResult {
  if (!isModelProvider(taskConfig.modelProvider)) {
    throw new Error(`Unknown decision provider: ${taskConfig.modelProvider}`);
  }
  const version = toSavedDecisionVersion(taskConfig);
  const templateFormat =
    version.state.kind === "text" && version.state.templateFormat === "F_STRING"
      ? TemplateFormats.FString
      : TemplateFormats.Mustache;
  const defaults = createDecisionTaskInstance();
  const instance: PlaygroundInstance = {
    ...defaults,
    id: generateInstanceId(),
    decisionRequest: savedDecisionVersionToDraft({ version, templateFormat }),
    model: {
      ...defaults.model,
      provider: taskConfig.modelProvider,
      modelName: taskConfig.modelName,
      customProvider: taskConfig.customProvider ?? null,
      baseUrl: taskConfig.baseUrl,
    },
  };
  return {
    playgroundProps: { instances: [instance], templateFormat },
    datasetId,
    stateByDatasetId: datasetId
      ? {
          [datasetId]: {
            templateVariablesPathByRole: {
              ...DEFAULT_TEMPLATE_VARIABLES_PATH_BY_ROLE,
              tested: taskConfig.inputValuesPath,
            },
            appendedMessagesPath: null,
            maxConcurrency,
          },
        }
      : {},
    selectedDatasetEvaluatorIds,
  };
}
