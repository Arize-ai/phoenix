/**
 * @generated SignedSource<<ddbcd29ce46951e3fce864493d13b2b9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CanonicalParameterName = "ANTHROPIC_EXTENDED_THINKING" | "MAX_COMPLETION_TOKENS" | "RANDOM_SEED" | "REASONING_EFFORT" | "RESPONSE_FORMAT" | "STOP_SEQUENCES" | "TEMPERATURE" | "TOOL_CHOICE" | "TOP_P";
export type ChatCompletionMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type ChatCompletionOverDatasetInput = {
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  datasetId: string;
  datasetVersionId?: string | null;
  evaluators?: ReadonlyArray<PlaygroundEvaluatorInput> | null;
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
  inputMapping?: any | null;
};
export type PlaygroundDatasetExamplesTableMutation$variables = {
  input: ChatCompletionOverDatasetInput;
};
export type PlaygroundDatasetExamplesTableMutation$data = {
  readonly chatCompletionOverDataset: {
    readonly __typename: "ChatCompletionOverDatasetMutationPayload";
    readonly examples: ReadonlyArray<{
      readonly datasetExampleId: string;
      readonly experimentRunId: string;
      readonly repetitionNumber: number;
      readonly result: {
        readonly __typename: "ChatCompletionMutationError";
        readonly message: string;
      } | {
        readonly __typename: "ChatCompletionMutationPayload";
        readonly content: string | null;
        readonly errorMessage: string | null;
        readonly evaluations: ReadonlyArray<{
          readonly label: string | null;
          readonly score: number | null;
        }>;
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
        };
        readonly toolCalls: ReadonlyArray<{
          readonly function: {
            readonly arguments: string;
            readonly name: string;
          };
          readonly id: string;
        }>;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      };
    }>;
    readonly experimentId: string;
  };
};
export type PlaygroundDatasetExamplesTableMutation = {
  response: PlaygroundDatasetExamplesTableMutation$data;
  variables: PlaygroundDatasetExamplesTableMutation$variables;
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
  "name": "experimentId",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "datasetExampleId",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "experimentRunId",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "repetitionNumber",
  "storageKey": null
},
v7 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "message",
      "storageKey": null
    }
  ],
  "type": "ChatCompletionMutationError",
  "abstractKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "content",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "errorMessage",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "Span",
  "kind": "LinkedField",
  "name": "span",
  "plural": false,
  "selections": [
    (v10/*: any*/),
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
      "selections": [
        (v10/*: any*/)
      ],
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
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "traceId",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "ChatCompletionToolCall",
  "kind": "LinkedField",
  "name": "toolCalls",
  "plural": true,
  "selections": [
    (v10/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "ChatCompletionFunctionCall",
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
  "storageKey": null
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundDatasetExamplesTableMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "ChatCompletionOverDatasetMutationPayload",
        "kind": "LinkedField",
        "name": "chatCompletionOverDataset",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "ChatCompletionOverDatasetMutationExamplePayload",
            "kind": "LinkedField",
            "name": "examples",
            "plural": true,
            "selections": [
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "result",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v7/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v8/*: any*/),
                      (v9/*: any*/),
                      (v11/*: any*/),
                      (v12/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExperimentRunAnnotation",
                        "kind": "LinkedField",
                        "name": "evaluations",
                        "plural": true,
                        "selections": [
                          (v13/*: any*/),
                          (v14/*: any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "ChatCompletionMutationPayload",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundDatasetExamplesTableMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "ChatCompletionOverDatasetMutationPayload",
        "kind": "LinkedField",
        "name": "chatCompletionOverDataset",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "ChatCompletionOverDatasetMutationExamplePayload",
            "kind": "LinkedField",
            "name": "examples",
            "plural": true,
            "selections": [
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "result",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v7/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v8/*: any*/),
                      (v9/*: any*/),
                      (v11/*: any*/),
                      (v12/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExperimentRunAnnotation",
                        "kind": "LinkedField",
                        "name": "evaluations",
                        "plural": true,
                        "selections": [
                          (v13/*: any*/),
                          (v14/*: any*/),
                          (v10/*: any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "ChatCompletionMutationPayload",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "31ff62ff27fa7a6bd0861cafa2aa5000",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundDatasetExamplesTableMutation(\n  $input: ChatCompletionOverDatasetInput!\n) {\n  chatCompletionOverDataset(input: $input) {\n    __typename\n    experimentId\n    examples {\n      datasetExampleId\n      experimentRunId\n      repetitionNumber\n      result {\n        __typename\n        ... on ChatCompletionMutationError {\n          message\n        }\n        ... on ChatCompletionMutationPayload {\n          content\n          errorMessage\n          span {\n            id\n            tokenCountTotal\n            costSummary {\n              total {\n                cost\n              }\n            }\n            latencyMs\n            project {\n              id\n            }\n            context {\n              traceId\n            }\n          }\n          toolCalls {\n            id\n            function {\n              name\n              arguments\n            }\n          }\n          evaluations {\n            label\n            score\n            id\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f68931087570eb3b348d2522616fff74";

export default node;
