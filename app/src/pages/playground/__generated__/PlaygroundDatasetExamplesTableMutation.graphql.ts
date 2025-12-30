/**
 * @generated SignedSource<<977e2bfc6510620322f79fb415e02fa0>>
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
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  customHeaders?: any | null;
  endpoint?: string | null;
  name: string;
  providerKey: GenerativeProviderKey;
  region?: string | null;
};
export type GenerativeCredentialInput = {
  envVarName: string;
  value: string;
};
export type GenerativeModelCustomProviderInput = {
  extraHeaders?: any | null;
  modelName: string;
  provider: string;
  providerId: string;
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
  id: string;
  inputMapping?: EvaluatorInputMappingInput;
};
export type EvaluatorInputMappingInput = {
  literalMapping?: any;
  pathMapping?: any;
};
export type PlaygroundDatasetExamplesTableMutation$variables = {
  input: ChatCompletionOverDatasetInput;
};
export type PlaygroundDatasetExamplesTableMutation$data = {
  readonly chatCompletionOverDataset: {
    readonly examples: ReadonlyArray<{
      readonly datasetExampleId: string;
      readonly experimentRunId: string;
      readonly repetition: {
        readonly content: string | null;
        readonly errorMessage: string | null;
        readonly evaluations: ReadonlyArray<{
          readonly annotatorKind: ExperimentRunAnnotatorKind;
          readonly explanation: string | null;
          readonly id: string;
          readonly label: string | null;
          readonly metadata: any;
          readonly name: string;
          readonly score: number | null;
          readonly startTime: string;
          readonly trace: {
            readonly projectId: string;
            readonly traceId: string;
          } | null;
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
        } | null;
        readonly toolCalls: ReadonlyArray<{
          readonly function: {
            readonly arguments: string;
            readonly name: string;
          };
          readonly id: string;
        }>;
      };
      readonly repetitionNumber: number;
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
  "name": "experimentId",
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
  "name": "experimentRunId",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "repetitionNumber",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "content",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "errorMessage",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "concreteType": "Span",
  "kind": "LinkedField",
  "name": "span",
  "plural": false,
  "selections": [
    (v8/*: any*/),
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
        (v8/*: any*/)
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
        (v9/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
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
    (v8/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "ChatCompletionFunctionCall",
      "kind": "LinkedField",
      "name": "function",
      "plural": false,
      "selections": [
        (v11/*: any*/),
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
          {
            "alias": null,
            "args": null,
            "concreteType": "ChatCompletionOverDatasetMutationExamplePayload",
            "kind": "LinkedField",
            "name": "examples",
            "plural": true,
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ChatCompletionRepetition",
                "kind": "LinkedField",
                "name": "repetition",
                "plural": false,
                "selections": [
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v10/*: any*/),
                  (v12/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunAnnotation",
                    "kind": "LinkedField",
                    "name": "evaluations",
                    "plural": true,
                    "selections": [
                      (v8/*: any*/),
                      (v11/*: any*/),
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
                          (v9/*: any*/),
                          (v19/*: any*/)
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
          {
            "alias": null,
            "args": null,
            "concreteType": "ChatCompletionOverDatasetMutationExamplePayload",
            "kind": "LinkedField",
            "name": "examples",
            "plural": true,
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ChatCompletionRepetition",
                "kind": "LinkedField",
                "name": "repetition",
                "plural": false,
                "selections": [
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v10/*: any*/),
                  (v12/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunAnnotation",
                    "kind": "LinkedField",
                    "name": "evaluations",
                    "plural": true,
                    "selections": [
                      (v8/*: any*/),
                      (v11/*: any*/),
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
                          (v9/*: any*/),
                          (v19/*: any*/),
                          (v8/*: any*/)
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
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "34c45498b7aee9435bf246bcf6d55531",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundDatasetExamplesTableMutation(\n  $input: ChatCompletionOverDatasetInput!\n) {\n  chatCompletionOverDataset(input: $input) {\n    experimentId\n    examples {\n      datasetExampleId\n      experimentRunId\n      repetitionNumber\n      repetition {\n        content\n        errorMessage\n        span {\n          id\n          tokenCountTotal\n          costSummary {\n            total {\n              cost\n            }\n          }\n          latencyMs\n          project {\n            id\n          }\n          context {\n            traceId\n          }\n        }\n        toolCalls {\n          id\n          function {\n            name\n            arguments\n          }\n        }\n        evaluations {\n          id\n          name\n          label\n          score\n          annotatorKind\n          explanation\n          metadata\n          startTime\n          trace {\n            traceId\n            projectId\n            id\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "408c5f4c7be483c10b33f761d78c0dfc";

export default node;
