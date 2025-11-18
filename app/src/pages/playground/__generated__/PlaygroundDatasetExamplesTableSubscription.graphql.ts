/**
 * @generated SignedSource<<88e693ba83b91c42384caff5402e1e5f>>
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
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type ChatCompletionOverDatasetInput = {
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
  tools?: ReadonlyArray<any> | null;
};
export type ChatCompletionMessageInput = {
  content?: any;
  role: ChatCompletionMessageRole;
  toolCallId?: string | null;
  toolCalls?: ReadonlyArray<any> | null;
};
export type GenerativeModelInput = {
  apiVersion?: string | null;
  baseUrl?: string | null;
  customHeaders?: any | null;
  endpoint?: string | null;
  name: string;
  providerKey: GenerativeProviderKey;
  region?: string | null;
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
export type GenerativeCredentialInput = {
  envVarName: string;
  value: string;
};
export type PlaygroundEvaluatorInput = {
  id: string;
  inputMapping?: EvaluatorInputMapping;
};
export type EvaluatorInputMapping = {
  literalMapping?: any;
  pathMapping?: any;
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
    readonly experimentRunEvaluation: {
      readonly annotatorKind: ExperimentRunAnnotatorKind;
      readonly explanation: string | null;
      readonly label: string | null;
      readonly metadata: any;
      readonly score: number | null;
      readonly startTime: string;
      readonly trace: {
        readonly projectId: string;
        readonly traceId: string;
      } | null;
    } | null;
    readonly repetitionNumber: number | null;
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
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        },
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
v8 = [
  (v6/*: any*/)
],
v9 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Experiment",
      "kind": "LinkedField",
      "name": "experiment",
      "plural": false,
      "selections": (v8/*: any*/),
      "storageKey": null
    }
  ],
  "type": "ChatCompletionSubscriptionExperiment",
  "abstractKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v11 = {
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
          "selections": (v8/*: any*/),
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
            (v10/*: any*/)
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
      "selections": (v8/*: any*/),
      "storageKey": null
    }
  ],
  "type": "ChatCompletionSubscriptionResult",
  "abstractKey": null
},
v12 = {
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
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectId",
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
          (v7/*: any*/),
          (v9/*: any*/),
          (v11/*: any*/),
          (v12/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRunAnnotation",
                "kind": "LinkedField",
                "name": "experimentRunEvaluation",
                "plural": false,
                "selections": [
                  (v13/*: any*/),
                  (v14/*: any*/),
                  (v15/*: any*/),
                  (v16/*: any*/),
                  (v17/*: any*/),
                  (v18/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Trace",
                    "kind": "LinkedField",
                    "name": "trace",
                    "plural": false,
                    "selections": [
                      (v10/*: any*/),
                      (v19/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
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
          (v7/*: any*/),
          (v9/*: any*/),
          (v11/*: any*/),
          (v12/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRunAnnotation",
                "kind": "LinkedField",
                "name": "experimentRunEvaluation",
                "plural": false,
                "selections": [
                  (v13/*: any*/),
                  (v14/*: any*/),
                  (v15/*: any*/),
                  (v16/*: any*/),
                  (v17/*: any*/),
                  (v18/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Trace",
                    "kind": "LinkedField",
                    "name": "trace",
                    "plural": false,
                    "selections": [
                      (v10/*: any*/),
                      (v19/*: any*/),
                      (v6/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v6/*: any*/)
                ],
                "storageKey": null
              }
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
    "cacheID": "09d3800a71ec49fc5456a91b336f5d2c",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableSubscription",
    "operationKind": "subscription",
    "text": "subscription PlaygroundDatasetExamplesTableSubscription(\n  $input: ChatCompletionOverDatasetInput!\n) {\n  chatCompletionOverDataset(input: $input) {\n    __typename\n    ... on TextChunk {\n      content\n      datasetExampleId\n      repetitionNumber\n    }\n    ... on ToolCallChunk {\n      id\n      datasetExampleId\n      repetitionNumber\n      function {\n        name\n        arguments\n      }\n    }\n    ... on ChatCompletionSubscriptionExperiment {\n      experiment {\n        id\n      }\n    }\n    ... on ChatCompletionSubscriptionResult {\n      datasetExampleId\n      repetitionNumber\n      span {\n        id\n        tokenCountTotal\n        costSummary {\n          total {\n            cost\n          }\n        }\n        latencyMs\n        project {\n          id\n        }\n        context {\n          traceId\n        }\n      }\n      experimentRun {\n        id\n      }\n    }\n    ... on ChatCompletionSubscriptionError {\n      datasetExampleId\n      repetitionNumber\n      message\n    }\n    ... on EvaluationChunk {\n      datasetExampleId\n      repetitionNumber\n      experimentRunEvaluation {\n        label\n        score\n        annotatorKind\n        explanation\n        metadata\n        startTime\n        trace {\n          traceId\n          projectId\n          id\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8e349304f8d10f99bc3e755cec72fbd1";

export default node;
