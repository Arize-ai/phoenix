/**
 * Rehydrates playground state from an experiment's task config.
 *
 * Fetches the experiment's ExperimentJob.taskConfig via GraphQL and
 * maps it to PlaygroundProps that can be passed to <Playground>.
 */

import { fetchQuery, graphql } from "relay-runtime";

import RelayEnvironment from "@phoenix/RelayEnvironment";
import {
  DEFAULT_INSTANCE_PARAMS,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_TEMPLATE_VARIABLES_PATH,
  generateInstanceId,
} from "@phoenix/store/playground/playgroundStore";
import type {
  ModelConfig,
  PlaygroundInstance,
  PlaygroundProps,
} from "@phoenix/store/playground/types";

import type { experimentRehydrationQuery } from "./__generated__/experimentRehydrationQuery.graphql";
import { buildPlaygroundInstanceFieldsFromPromptConfig } from "./promptConfigToPlaygroundInstance";

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
`;

export type ExperimentRehydrationResult = {
  playgroundProps: Partial<PlaygroundProps>;
  datasetId: string | null;
  stateByDatasetId: Record<
    string,
    {
      templateVariablesPath?: string | null;
      appendedMessagesPath?: string | null;
      maxConcurrency: number;
    }
  >;
  selectedDatasetEvaluatorIds: string[];
};

type TaskConfig = NonNullable<
  NonNullable<
    NonNullable<
      experimentRehydrationQuery["response"]["node"]["job"]
    >["taskConfig"]
  >
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

  const templateVariablesPath =
    taskConfig.playgroundConfig?.templateVariablesPath ??
    DEFAULT_TEMPLATE_VARIABLES_PATH;
  const appendedMessagesPath =
    taskConfig.playgroundConfig?.appendedMessagesPath ?? null;

  const stateByDatasetId: ExperimentRehydrationResult["stateByDatasetId"] =
    datasetId
      ? {
          [datasetId]: {
            templateVariablesPath,
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
  if (!job?.taskConfig) return null;

  const selectedDatasetEvaluatorIds = job.datasetEvaluators.edges.map(
    (edge) => edge.node.id
  );

  return taskConfigToPlaygroundProps(
    job.taskConfig,
    job.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
    node.dataset?.id ?? null,
    selectedDatasetEvaluatorIds
  );
}
