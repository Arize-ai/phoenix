/**
 * Rehydrates playground state from an experiment's task config.
 *
 * Fetches the experiment's ExperimentJob.taskConfig via GraphQL and
 * maps it to PlaygroundProps that can be passed to <Playground>.
 */

import { fetchQuery, graphql } from "relay-runtime";

import type { GenerativeProviderKey } from "@phoenix/components/playground/model/__generated__/ModelSupportedParamsFetcherQuery.graphql";
import { DEFAULT_OPENAI_API_TYPE } from "@phoenix/constants/generativeConstants";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import type {
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from "@phoenix/schemas/promptSchemas";
import { fromPromptToolCallPart } from "@phoenix/schemas/toolCallSchemas";
import {
  DEFAULT_INSTANCE_PARAMS,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_TEMPLATE_VARIABLES_PATH,
  generateInstanceId,
  generateMessageId,
  generateToolId,
} from "@phoenix/store/playground/playgroundStore";
import type {
  ModelConfig,
  PlaygroundInstance,
  PlaygroundProps,
} from "@phoenix/store/playground/types";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";
import {
  asTextPart,
  asToolCallPart,
  asToolResultPart,
} from "@phoenix/utils/promptUtils";

import type { experimentRehydrationQuery } from "./__generated__/experimentRehydrationQuery.graphql";
import {
  fetchSupportedInvocationParameters,
  objectToInvocationParameters,
} from "./fetchPlaygroundPrompt";
import { getChatRole } from "./playgroundUtils";

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
                  function {
                    name
                    description
                    parameters
                    strict
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
              invocationParameters
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
  selectedDatasetEvaluatorIds: string[],
  supportedInvocationParameters: PlaygroundInstance["model"]["supportedInvocationParameters"]
): ExperimentRehydrationResult {
  const prompt = taskConfig.prompt;
  const provider = prompt.modelProvider as GenerativeProviderKey;

  // --- Messages ---
  const messages =
    "messages" in prompt.template
      ? prompt.template.messages.map((m) => {
          const textContent = (
            m.content.map(asTextPart).filter(Boolean) as TextPart[]
          )
            .map((part) => part.text.text)
            .join("");
          const toolCallParts = m.content
            .map(asToolCallPart)
            .filter(Boolean) as ToolCallPart[];
          const toolResultParts = m.content
            .map(asToolResultPart)
            .filter(Boolean) as ToolResultPart[];
          const firstToolResultPart = toolResultParts.at(0);
          const role = getChatRole(m.role);

          if (role === "tool" && firstToolResultPart) {
            return {
              id: generateMessageId(),
              role,
              content:
                typeof firstToolResultPart.toolResult.result === "string"
                  ? firstToolResultPart.toolResult.result
                  : safelyStringifyJSON(
                      firstToolResultPart.toolResult.result,
                      null,
                      2
                    ).json || "",
              toolCallId: firstToolResultPart.toolResult.toolCallId,
            };
          }

          if (role === "ai" && toolCallParts.length > 0) {
            return {
              id: generateMessageId(),
              role,
              toolCalls: toolCallParts.map((toolCall) =>
                fromPromptToolCallPart(toolCall, provider)
              ),
            };
          }

          return {
            id: generateMessageId(),
            role,
            content: textContent,
          };
        })
      : [];

  // --- Tools ---
  const toolsList = prompt.tools?.tools ?? [];
  const tools = toolsList.map((t) => ({
    id: generateToolId(),
    editorType: "json" as const,
    definition: {
      name: t.function.name,
      description: t.function.description ?? null,
      parameters: t.function.parameters,
      strict: t.function.strict ?? null,
    },
  }));

  // --- Tool Choice ---
  const rawToolChoice = prompt.tools?.toolChoice;
  const toolChoice = rawToolChoice
    ? ({
        type: rawToolChoice.type as
          | "NONE"
          | "ZERO_OR_MORE"
          | "ONE_OR_MORE"
          | "SPECIFIC_FUNCTION",
        ...(rawToolChoice.functionName != null && {
          functionName: rawToolChoice.functionName,
        }),
      } as const)
    : undefined;

  // --- Invocation Parameters ---
  const rawInvocationParams = (prompt.invocationParameters ?? {}) as Record<
    string,
    unknown
  >;
  const invocationParameters = objectToInvocationParameters(
    rawInvocationParams,
    supportedInvocationParameters
  );

  // --- Response Format ---
  const responseFormat = prompt.responseFormat
    ? {
        type: "json_schema" as const,
        jsonSchema: prompt.responseFormat.jsonSchema,
      }
    : null;

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

  const defaults = DEFAULT_INSTANCE_PARAMS();
  const instance: PlaygroundInstance = {
    ...defaults,
    id: generateInstanceId(),
    selectedRepetitionNumber: 1,
    model: {
      ...defaults.model,
      modelName: prompt.modelName,
      provider,
      customProvider,
      supportedInvocationParameters,
      invocationParameters,
      responseFormat,
      ...connectionFields,
    },
    template: {
      __type: "chat",
      messages,
    },
    tools,
    toolChoice,
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

  const prompt = job.taskConfig.prompt;
  const isOpenAIProvider =
    prompt.modelProvider === "OPENAI" ||
    prompt.modelProvider === "AZURE_OPENAI";

  const supportedInvocationParameters =
    (await fetchSupportedInvocationParameters({
      modelName: prompt.modelName,
      providerKey: prompt.modelProvider,
      openaiApiType: isOpenAIProvider ? DEFAULT_OPENAI_API_TYPE : null,
    })) ?? [];

  const selectedDatasetEvaluatorIds = job.datasetEvaluators.edges.map(
    (edge) => edge.node.id
  );

  return taskConfigToPlaygroundProps(
    job.taskConfig,
    job.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
    node.dataset?.id ?? null,
    selectedDatasetEvaluatorIds,
    supportedInvocationParameters
  );
}
