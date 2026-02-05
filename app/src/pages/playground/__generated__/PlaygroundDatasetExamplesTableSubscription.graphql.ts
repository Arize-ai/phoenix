/**
 * @generated SignedSource<<89cafd1c331b99ea34894dd107f5f897>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CanonicalParameterName = "ANTHROPIC_EXTENDED_THINKING" | "MAX_COMPLETION_TOKENS" | "RANDOM_SEED" | "REASONING_EFFORT" | "RESPONSE_FORMAT" | "STOP_SEQUENCES" | "TEMPERATURE" | "TOOL_CHOICE" | "TOP_P";
export type ChatCompletionMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type ExperimentRunAnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type ChatCompletionOverDatasetInput = {
  appendedMessagesPath?: string | null;
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  datasetId: string;
  datasetVersionId?: string | null;
  evaluators?: ReadonlyArray<PlaygroundEvaluatorInput>;
  experimentDescription?: string | null;
  experimentMetadata?: any | null;
  experimentName?: string | null;
  invocationParameters?: ReadonlyArray<InvocationParameterInput>;
  messages: ReadonlyArray<ChatCompletionMessageInput>;
  model: GenerativeModelInput;
  promptName?: string | null;
  repetitions: number;
  splitIds?: ReadonlyArray<string> | null;
  templateFormat?: PromptTemplateFormat;
  templateVariablesPath?: string | null;
  tools?: ReadonlyArray<any> | null;
  tracingEnabled?: boolean;
};
export type ChatCompletionMessageInput = {
  content?: any;
  role: ChatCompletionMessageRole;
  toolCallId?: string | null;
  toolCalls?: ReadonlyArray<any> | null;
};
export type GenerativeModelInput = {
  builtin?: GenerativeModelBuiltinProviderInput | null;
  custom?: GenerativeModelCustomProviderInput | null;
};
export type GenerativeModelBuiltinProviderInput = {
  baseUrl?: string | null;
  customHeaders?: any | null;
  endpoint?: string | null;
  name: string;
  providerKey: GenerativeProviderKey;
  region?: string | null;
};
export type GenerativeModelCustomProviderInput = {
  extraHeaders?: any | null;
  modelName: string;
  providerId: string;
};
export type GenerativeCredentialInput = {
  envVarName: string;
  value: string;
};
export type InvocationParameterInput = {
  canonicalName?: CanonicalParameterName | null;
  invocationName: string;
  valueBool?: boolean | null;
  valueBoolean?: boolean | null;
  valueFloat?: number | null;
  valueInt?: number | null;
  valueJson?: any | null;
  valueString?: string | null;
  valueStringList?: ReadonlyArray<string> | null;
};
export type PlaygroundEvaluatorInput = {
  description?: string | null;
  id: string;
  inputMapping?: EvaluatorInputMappingInput;
  name: string;
  outputConfigOverrides?: ReadonlyArray<NamedAnnotationConfigOverrideInput> | null;
};
export type EvaluatorInputMappingInput = {
  literalMapping?: any;
  pathMapping?: any;
};
export type NamedAnnotationConfigOverrideInput = {
  name: string;
  override: AnnotationConfigOverrideInput;
};
export type AnnotationConfigOverrideInput = {
  categorical?: CategoricalAnnotationConfigOverrideInput | null;
  continuous?: ContinuousAnnotationConfigOverrideInput | null;
};
export type CategoricalAnnotationConfigOverrideInput = {
  optimizationDirection?: OptimizationDirection | null;
  values?: ReadonlyArray<CategoricalAnnotationConfigValueInput> | null;
};
export type CategoricalAnnotationConfigValueInput = {
  label: string;
  score?: number | null;
};
export type ContinuousAnnotationConfigOverrideInput = {
  lowerBound?: number | null;
  optimizationDirection?: OptimizationDirection | null;
  upperBound?: number | null;
};
export type PlaygroundDatasetExamplesTableSubscription$variables = {
  input: ChatCompletionOverDatasetInput;
};
export type PlaygroundDatasetExamplesTableSubscription$data = {
  readonly chatCompletionOverDataset: {
    readonly __typename: "ChatCompletionSubscriptionError";
    readonly datasetExampleId: string | null;
    readonly message: string;
    readonly repetitionNumber: number | null;
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
  "kind": "InlineFragment",
  "selections": [
    (v3/*: any*/),
    (v4/*: any*/),
    {
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
    {
      "alias": null,
      "args": null,
      "concreteType": "ExperimentRun",
      "kind": "LinkedField",
      "name": "experimentRun",
      "plural": false,
      "selections": (v9/*: any*/),
      "storageKey": null
    }
  ],
  "type": "ChatCompletionSubscriptionResult",
  "abstractKey": null
},
v13 = {
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
    }
  ],
  "type": "ChatCompletionSubscriptionError",
  "abstractKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatorName",
  "storageKey": null
},
v15 = {
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
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectId",
  "storageKey": null
},
v17 = {
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
          (v12/*: any*/),
          (v13/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v14/*: any*/),
              (v15/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v11/*: any*/),
                  (v16/*: any*/)
                ],
                "storageKey": null
              },
              (v17/*: any*/)
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
          (v12/*: any*/),
          (v13/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v14/*: any*/),
              (v15/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v11/*: any*/),
                  (v16/*: any*/),
                  (v6/*: any*/)
                ],
                "storageKey": null
              },
              (v17/*: any*/)
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
    "cacheID": "59848e300014c13cbfa3a75b4db687ac",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableSubscription",
    "operationKind": "subscription",
    "text": "subscription PlaygroundDatasetExamplesTableSubscription(\n  $input: ChatCompletionOverDatasetInput!\n) {\n  chatCompletionOverDataset(input: $input) {\n    __typename\n    ... on TextChunk {\n      content\n      datasetExampleId\n      repetitionNumber\n    }\n    ... on ToolCallChunk {\n      id\n      datasetExampleId\n      repetitionNumber\n      function {\n        name\n        arguments\n      }\n    }\n    ... on ChatCompletionSubscriptionExperiment {\n      experiment {\n        id\n      }\n    }\n    ... on ChatCompletionSubscriptionResult {\n      datasetExampleId\n      repetitionNumber\n      span {\n        id\n        tokenCountTotal\n        costSummary {\n          total {\n            cost\n          }\n        }\n        latencyMs\n        project {\n          id\n        }\n        context {\n          traceId\n        }\n      }\n      experimentRun {\n        id\n      }\n    }\n    ... on ChatCompletionSubscriptionError {\n      datasetExampleId\n      repetitionNumber\n      message\n    }\n    ... on EvaluationChunk {\n      datasetExampleId\n      repetitionNumber\n      evaluatorName\n      experimentRunEvaluation {\n        id\n        name\n        label\n        score\n        annotatorKind\n        explanation\n        metadata\n        startTime\n      }\n      trace {\n        traceId\n        projectId\n        id\n      }\n      error\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "33535629bd23d07817368b2581abca97";

export default node;
