/**
 * @generated SignedSource<<92c5fe412a1db375fe6bb3d12ad99aae>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentRunAnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type ChatCompletionOverDatasetInput = {
  appendedMessagesPath?: string | null;
  connectionConfig?: ConnectionConfigInput | null;
  createEphemeralExperiment?: boolean | null;
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  datasetId: string;
  datasetVersionId?: string | null;
  evaluators?: ReadonlyArray<PlaygroundEvaluatorInput>;
  experimentDescription?: string | null;
  experimentMetadata?: any | null;
  experimentName?: string | null;
  headers?: any | null;
  maxConcurrency?: number;
  promptName?: string | null;
  promptVersion: ChatPromptVersionInput;
  promptVersionId?: string | null;
  repetitions: number;
  splitIds?: ReadonlyArray<string> | null;
  streamModelOutput?: boolean;
  templateVariablesPath?: string | null;
  tracingEnabled?: boolean;
};
export type ChatPromptVersionInput = {
  customProviderId?: string | null;
  description?: string | null;
  invocationParameters?: any;
  modelName: string;
  modelProvider: GenerativeProviderKey;
  responseFormat?: PromptResponseFormatJSONSchemaInput | null;
  template: PromptChatTemplateInput;
  templateFormat: PromptTemplateFormat;
  tools?: PromptToolsInput | null;
};
export type PromptChatTemplateInput = {
  messages: ReadonlyArray<PromptMessageInput>;
};
export type PromptMessageInput = {
  content: ReadonlyArray<ContentPartInput>;
  role: PromptMessageRole;
};
export type ContentPartInput = {
  text?: TextContentValueInput | null;
  toolCall?: ToolCallContentValueInput | null;
  toolResult?: ToolResultContentValueInput | null;
};
export type TextContentValueInput = {
  text: string;
};
export type ToolCallContentValueInput = {
  toolCall: ToolCallFunctionInput;
  toolCallId: string;
};
export type ToolCallFunctionInput = {
  arguments: string;
  name: string;
  type?: string | null;
};
export type ToolResultContentValueInput = {
  result: any;
  toolCallId: string;
};
export type PromptToolsInput = {
  disableParallelToolCalls?: boolean | null;
  toolChoice?: PromptToolChoiceInput | null;
  tools: ReadonlyArray<PromptToolFunctionInput>;
};
export type PromptToolFunctionInput = {
  function: PromptToolFunctionDefinitionInput;
};
export type PromptToolFunctionDefinitionInput = {
  description?: string | null;
  name: string;
  parameters?: any | null;
  strict?: boolean | null;
};
export type PromptToolChoiceInput = {
  functionName?: string | null;
  none?: boolean | null;
  oneOrMore?: boolean | null;
  zeroOrMore?: boolean | null;
};
export type PromptResponseFormatJSONSchemaInput = {
  jsonSchema: PromptResponseFormatJSONSchemaDefinitionInput;
  type: string;
};
export type PromptResponseFormatJSONSchemaDefinitionInput = {
  description?: string | null;
  name: string;
  schema?: any | null;
  strict?: boolean | null;
};
export type ConnectionConfigInput = {
  azureEndpoint?: string | null;
  baseUrl?: string | null;
  endpointUrl?: string | null;
  openaiApiType?: OpenAIApiType | null;
  organization?: string | null;
  project?: string | null;
  regionName?: string | null;
};
export type GenerativeCredentialInput = {
  envVarName: string;
  value: string;
};
export type PlaygroundEvaluatorInput = {
  description?: string | null;
  id: string;
  inputMapping?: EvaluatorInputMappingInput;
  name: string;
  outputConfigs?: ReadonlyArray<AnnotationConfigInput> | null;
};
export type EvaluatorInputMappingInput = {
  literalMapping?: any;
  pathMapping?: any;
};
export type AnnotationConfigInput = {
  categorical?: CategoricalAnnotationConfigInput | null;
  continuous?: ContinuousAnnotationConfigInput | null;
  freeform?: FreeformAnnotationConfigInput | null;
};
export type CategoricalAnnotationConfigInput = {
  description?: string | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  values: ReadonlyArray<CategoricalAnnotationConfigValueInput>;
};
export type CategoricalAnnotationConfigValueInput = {
  label: string;
  score?: number | null;
};
export type ContinuousAnnotationConfigInput = {
  description?: string | null;
  lowerBound?: number | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  upperBound?: number | null;
};
export type FreeformAnnotationConfigInput = {
  description?: string | null;
  name: string;
};
export type PlaygroundDatasetExamplesTableSubscription$variables = {
  input: ChatCompletionOverDatasetInput;
};
export type PlaygroundDatasetExamplesTableSubscription$data = {
  readonly chatCompletionOverDataset: {
    readonly __typename: "ChatCompletionSubscriptionError";
    readonly datasetExampleId: string | null;
    readonly experimentRun: {
      readonly id: string;
    } | null;
    readonly message: string;
    readonly repetitionNumber: number | null;
    readonly span: {
      readonly context: {
        readonly traceId: string;
      };
      readonly costSummary: {
        readonly total: {
          readonly cost: number | null;
        };
      } | null;
      readonly id: string;
      readonly latencyMs: number | null;
      readonly project: {
        readonly id: string;
      };
      readonly tokenCountTotal: number | null;
    } | null;
  } | {
    readonly __typename: "ChatCompletionSubscriptionExperiment";
    readonly experiment: {
      readonly id: string;
    };
  } | {
    readonly __typename: "ChatCompletionSubscriptionResult";
    readonly datasetExampleId: string | null;
    readonly experimentRun: {
      readonly id: string;
    } | null;
    readonly repetitionNumber: number | null;
    readonly span: {
      readonly context: {
        readonly traceId: string;
      };
      readonly costSummary: {
        readonly total: {
          readonly cost: number | null;
        };
      } | null;
      readonly id: string;
      readonly latencyMs: number | null;
      readonly project: {
        readonly id: string;
      };
      readonly tokenCountTotal: number | null;
    } | null;
  } | {
    readonly __typename: "EvaluationChunk";
    readonly datasetExampleId: string | null;
    readonly error: string | null;
    readonly evaluatorName: string;
    readonly experimentRunEvaluation: {
      readonly annotatorKind: ExperimentRunAnnotatorKind;
      readonly explanation: string | null;
      readonly id: string;
      readonly label: string | null;
      readonly metadata: any;
      readonly name: string;
      readonly score: number | null;
      readonly startTime: string;
    } | null;
    readonly repetitionNumber: number | null;
    readonly trace: {
      readonly projectId: string;
      readonly traceId: string;
    } | null;
  } | {
    readonly __typename: "TextChunk";
    readonly content: string;
    readonly datasetExampleId: string | null;
    readonly repetitionNumber: number | null;
  } | {
    readonly __typename: "ToolCallChunk";
    readonly datasetExampleId: string | null;
    readonly function: {
      readonly arguments: string;
      readonly name: string;
    };
    readonly id: string;
    readonly repetitionNumber: number | null;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type PlaygroundDatasetExamplesTableSubscription = {
  response: PlaygroundDatasetExamplesTableSubscription$data;
  variables: PlaygroundDatasetExamplesTableSubscription$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "datasetExampleId",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "repetitionNumber",
  "storageKey": null
},
v5 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "content",
      "storageKey": null
    },
    (v3/*: any*/),
    (v4/*: any*/)
  ],
  "type": "TextChunk",
  "abstractKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v8 = {
  "kind": "InlineFragment",
  "selections": [
    (v6/*: any*/),
    (v3/*: any*/),
    (v4/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "FunctionCallChunk",
      "kind": "LinkedField",
      "name": "function",
      "plural": false,
      "selections": [
        (v7/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "arguments",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ToolCallChunk",
  "abstractKey": null
},
v9 = [
  (v6/*: any*/)
],
v10 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Experiment",
      "kind": "LinkedField",
      "name": "experiment",
      "plural": false,
      "selections": (v9/*: any*/),
      "storageKey": null
    }
  ],
  "type": "ChatCompletionSubscriptionExperiment",
  "abstractKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "Span",
  "kind": "LinkedField",
  "name": "span",
  "plural": false,
  "selections": [
    (v6/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "tokenCountTotal",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "SpanCostSummary",
      "kind": "LinkedField",
      "name": "costSummary",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "total",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cost",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "latencyMs",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Project",
      "kind": "LinkedField",
      "name": "project",
      "plural": false,
      "selections": (v9/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "SpanContext",
      "kind": "LinkedField",
      "name": "context",
      "plural": false,
      "selections": [
        (v11/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "ExperimentRun",
  "kind": "LinkedField",
  "name": "experimentRun",
  "plural": false,
  "selections": (v9/*: any*/),
  "storageKey": null
},
v14 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*: any*/),
    (v4/*: any*/),
    (v12/*: any*/),
    (v13/*: any*/)
  ],
  "type": "ChatCompletionSubscriptionResult",
  "abstractKey": null
},
v15 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*: any*/),
    (v4/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "message",
      "storageKey": null
    },
    (v12/*: any*/),
    (v13/*: any*/)
  ],
  "type": "ChatCompletionSubscriptionError",
  "abstractKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatorName",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "ExperimentRunAnnotation",
  "kind": "LinkedField",
  "name": "experimentRunEvaluation",
  "plural": false,
  "selections": [
    (v6/*: any*/),
    (v7/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "label",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "score",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "annotatorKind",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "explanation",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "metadata",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "startTime",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectId",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "error",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundDatasetExamplesTableSubscription",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "chatCompletionOverDataset",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v5/*: any*/),
          (v8/*: any*/),
          (v10/*: any*/),
          (v14/*: any*/),
          (v15/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v16/*: any*/),
              (v17/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v11/*: any*/),
                  (v18/*: any*/)
                ],
                "storageKey": null
              },
              (v19/*: any*/)
            ],
            "type": "EvaluationChunk",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundDatasetExamplesTableSubscription",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "chatCompletionOverDataset",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v5/*: any*/),
          (v8/*: any*/),
          (v10/*: any*/),
          (v14/*: any*/),
          (v15/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v16/*: any*/),
              (v17/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v11/*: any*/),
                  (v18/*: any*/),
                  (v6/*: any*/)
                ],
                "storageKey": null
              },
              (v19/*: any*/)
            ],
            "type": "EvaluationChunk",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "05cb4d6b7ab41e566e27ca08e220c0c0",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableSubscription",
    "operationKind": "subscription",
    "text": "subscription PlaygroundDatasetExamplesTableSubscription(\n  $input: ChatCompletionOverDatasetInput!\n) {\n  chatCompletionOverDataset(input: $input) {\n    __typename\n    ... on TextChunk {\n      content\n      datasetExampleId\n      repetitionNumber\n    }\n    ... on ToolCallChunk {\n      id\n      datasetExampleId\n      repetitionNumber\n      function {\n        name\n        arguments\n      }\n    }\n    ... on ChatCompletionSubscriptionExperiment {\n      experiment {\n        id\n      }\n    }\n    ... on ChatCompletionSubscriptionResult {\n      datasetExampleId\n      repetitionNumber\n      span {\n        id\n        tokenCountTotal\n        costSummary {\n          total {\n            cost\n          }\n        }\n        latencyMs\n        project {\n          id\n        }\n        context {\n          traceId\n        }\n      }\n      experimentRun {\n        id\n      }\n    }\n    ... on ChatCompletionSubscriptionError {\n      datasetExampleId\n      repetitionNumber\n      message\n      span {\n        id\n        tokenCountTotal\n        costSummary {\n          total {\n            cost\n          }\n        }\n        latencyMs\n        project {\n          id\n        }\n        context {\n          traceId\n        }\n      }\n      experimentRun {\n        id\n      }\n    }\n    ... on EvaluationChunk {\n      datasetExampleId\n      repetitionNumber\n      evaluatorName\n      experimentRunEvaluation {\n        id\n        name\n        label\n        score\n        annotatorKind\n        explanation\n        metadata\n        startTime\n      }\n      trace {\n        traceId\n        projectId\n        id\n      }\n      error\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e035a08659fb9434a83d35b0b5de6b13";

export default node;
