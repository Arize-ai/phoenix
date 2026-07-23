import { fetchQuery, graphql } from "react-relay";

import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import type { fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key } from "@phoenix/pages/playground/__generated__/fetchPlaygroundPrompt_promptVersionToInstance_promptVersion.graphql";
import { readPlaygroundPromptVersion } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { readPromptInvocationParameters } from "@phoenix/pages/playground/PromptInvocationParametersReadableFragment";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { readDatasetEvaluatorDefinitionBodyQuery } from "./__generated__/readDatasetEvaluatorDefinitionBodyQuery.graphql";
import { truncateStringLeaves } from "./truncate";

// Selections mirror the edit slideover so what the agent reads equals what the user edits.
const bodyQuery = graphql`
  query readDatasetEvaluatorDefinitionBodyQuery(
    $datasetId: ID!
    $datasetEvaluatorId: ID!
  ) {
    dataset: node(id: $datasetId) {
      ... on Dataset {
        datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {
          id
          name
          inputMapping {
            literalMapping
            pathMapping
          }
          outputConfigs {
            __typename
            ... on CategoricalAnnotationConfig {
              name
              optimizationDirection
              values {
                label
                score
              }
            }
            ... on ContinuousAnnotationConfig {
              name
              optimizationDirection
              lowerBound
              upperBound
            }
            ... on FreeformAnnotationConfig {
              name
              optimizationDirection
              threshold
              lowerBound
              upperBound
            }
          }
          evaluator {
            id
            kind
            isBuiltin
            ... on CodeEvaluator {
              language
              sandboxConfig {
                id
              }
              currentVersion {
                sourceCode
              }
            }
            ... on LLMEvaluator {
              promptVersion {
                ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
              }
            }
            ... on BuiltInEvaluator {
              metadata
              inputSchema
            }
          }
        }
      }
    }
  }
`;

export type DatasetEvaluatorDefinition = {
  datasetEvaluatorId: string;
  name: string;
  kind: string;
  isBuiltin: boolean;
  definition: unknown;
};

export type ReadEvaluatorDefinitionResult =
  | { ok: true; definition: DatasetEvaluatorDefinition }
  | { ok: false; error: string };

export async function readDatasetEvaluatorDefinition({
  datasetId,
  datasetEvaluatorId,
}: {
  datasetId: string;
  datasetEvaluatorId: string;
}): Promise<ReadEvaluatorDefinitionResult> {
  let data:
    | readDatasetEvaluatorDefinitionBodyQuery["response"]
    | null
    | undefined;
  try {
    data = await fetchQuery<readDatasetEvaluatorDefinitionBodyQuery>(
      RelayEnvironment,
      bodyQuery,
      { datasetId, datasetEvaluatorId }
    ).toPromise();
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : `Failed to read evaluator ${datasetEvaluatorId}.`,
    };
  }

  const datasetEvaluator = data?.dataset.datasetEvaluator;
  if (!datasetEvaluator) {
    return {
      ok: false,
      error:
        `Evaluator ${datasetEvaluatorId} could not be read (it may have been ` +
        `deleted). Re-check the roster and retry.`,
    };
  }

  const evaluator = datasetEvaluator.evaluator;
  const definition = truncateStringLeaves<DatasetEvaluatorDefinition>({
    datasetEvaluatorId: datasetEvaluator.id,
    name: datasetEvaluator.name,
    kind: evaluator.kind,
    isBuiltin: evaluator.isBuiltin,
    definition: buildBody(datasetEvaluator),
  });
  return { ok: true, definition };
}

type DatasetEvaluatorNode = NonNullable<
  readDatasetEvaluatorDefinitionBodyQuery["response"]["dataset"]["datasetEvaluator"]
>;

function buildBody(datasetEvaluator: DatasetEvaluatorNode): unknown {
  const { inputMapping, outputConfigs, evaluator } = datasetEvaluator;
  switch (evaluator.kind) {
    case "CODE":
      return {
        sourceCode: evaluator.currentVersion?.sourceCode ?? null,
        language: evaluator.language ?? null,
        sandboxConfigId: evaluator.sandboxConfig?.id ?? null,
        inputMapping,
        outputConfigs,
      };
    case "LLM":
      return buildLlmBody({ inputMapping, outputConfigs, evaluator });
    case "BUILTIN":
      return {
        metadata: evaluator.metadata ?? null,
        inputSchema: evaluator.inputSchema ?? null,
        outputConfigs,
      };
    default:
      return { inputMapping, outputConfigs };
  }
}

function buildLlmBody({
  inputMapping,
  outputConfigs,
  evaluator,
}: {
  inputMapping: DatasetEvaluatorNode["inputMapping"];
  outputConfigs: DatasetEvaluatorNode["outputConfigs"];
  evaluator: DatasetEvaluatorNode["evaluator"];
}): unknown {
  const promptVersionRef =
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the query spreads fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on promptVersion, so the node carries the fragment key
    evaluator.promptVersion as fetchPlaygroundPrompt_promptVersionToInstance_promptVersion$key | null;
  if (promptVersionRef == null) {
    return { inputMapping, outputConfigs };
  }
  const promptVersion = readPlaygroundPromptVersion(promptVersionRef);
  return {
    modelName: promptVersion.modelName,
    modelProvider: promptVersion.modelProvider,
    invocationParameters: readPromptInvocationParameters(
      promptVersion.invocationParameters
    ),
    messages:
      promptVersion.template.__typename === "PromptChatTemplate"
        ? promptVersion.template.messages
        : null,
    tools: promptVersion.tools,
    responseFormat: promptVersion.responseFormat,
    customProvider: promptVersion.customProvider,
    includeExplanation: inferIncludeExplanationFromPrompt(promptVersion.tools),
    inputMapping,
    outputConfigs,
  };
}
