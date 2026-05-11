/**
 * @generated SignedSource<<848b1c514e89bf6ba706fe07919e1ab6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentJobStatus = "COMPLETED" | "ERROR" | "RUNNING" | "STOPPED";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type PromptTemplateType = "CHAT" | "STRING";
export type ExperimentDetailsDialogQuery$variables = {
  errorsAfter?: string | null;
  errorsFirst?: number | null;
  experimentId: string;
};
export type ExperimentDetailsDialogQuery$data = {
  readonly experiment: {
    readonly averageRunLatencyMs?: number | null;
    readonly costSummary?: {
      readonly completion: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
      readonly prompt: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
      readonly total: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
    };
    readonly createdAt?: string;
    readonly description?: string | null;
    readonly errorRate?: number | null;
    readonly expectedRunCount?: number;
    readonly id?: string;
    readonly job?: {
      readonly createdAt: string;
      readonly maxConcurrency: number;
      readonly status: ExperimentJobStatus;
      readonly taskConfig: {
        readonly connection: {
          readonly __typename: "AWSBedrockConnectionConfig";
          readonly endpointUrl: string | null;
          readonly regionName: string | null;
        } | {
          readonly __typename: "AnthropicConnectionConfig";
          readonly baseUrl: string | null;
        } | {
          readonly __typename: "AzureOpenAIConnectionConfig";
          readonly azureEndpoint: string;
          readonly openaiApiType: OpenAIApiType;
        } | {
          readonly __typename: "GoogleGenAIConnectionConfig";
          readonly baseUrl: string | null;
        } | {
          readonly __typename: "OpenAIConnectionConfig";
          readonly baseUrl: string | null;
          readonly openaiApiType: OpenAIApiType;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        } | null;
        readonly id: string;
        readonly prompt: {
          readonly invocationParameters: {
            readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParametersReadableFragment">;
          };
          readonly modelName: string;
          readonly modelProvider: GenerativeProviderKey;
          readonly templateFormat: PromptTemplateFormat;
          readonly templateType: PromptTemplateType;
        };
        readonly streamModelOutput: boolean;
      } | null;
      readonly " $fragmentSpreads": FragmentRefs<"ExperimentDetailsDialog_jobErrors">;
    } | null;
    readonly metadata?: any;
    readonly name?: string;
    readonly project?: {
      readonly id: string;
    } | null;
    readonly repetitions?: number;
    readonly runCount?: number;
    readonly sequenceNumber?: number;
    readonly updatedAt?: string;
    readonly user?: {
      readonly profilePictureUrl: string | null;
      readonly username: string;
    } | null;
  };
};
export type ExperimentDetailsDialogQuery = {
  response: ExperimentDetailsDialogQuery$data;
  variables: ExperimentDetailsDialogQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "errorsAfter"
},
v1 = {
  "defaultValue": 20,
  "kind": "LocalArgument",
  "name": "errorsFirst"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "experimentId"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "experimentId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sequenceNumber",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "repetitions",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "errorRate",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "runCount",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "expectedRunCount",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "averageRunLatencyMs",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": [
    (v4/*: any*/)
  ],
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v19 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "tokens",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v20 = {
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
      "selections": (v19/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "prompt",
      "plural": false,
      "selections": (v19/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "completion",
      "plural": false,
      "selections": (v19/*: any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxConcurrency",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "streamModelOutput",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateType",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateFormat",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "temperature",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frequencyPenalty",
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "presencePenalty",
  "storageKey": null
},
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "topP",
  "storageKey": null
},
v33 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "extraBody",
  "storageKey": null
},
v34 = {
  "kind": "InlineFragment",
  "selections": [
    (v29/*: any*/),
    {
      "alias": "openaiMaxTokens",
      "args": null,
      "kind": "ScalarField",
      "name": "maxTokens",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "maxCompletionTokens",
      "storageKey": null
    },
    (v30/*: any*/),
    (v31/*: any*/),
    (v32/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "seed",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "stop",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "reasoningEffort",
      "storageKey": null
    },
    (v33/*: any*/)
  ],
  "type": "PromptOpenAIInvocationParameters",
  "abstractKey": null
},
v35 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v36 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "anthropicMaxTokens",
      "args": null,
      "kind": "ScalarField",
      "name": "maxTokens",
      "storageKey": null
    },
    (v29/*: any*/),
    (v32/*: any*/),
    (v35/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptAnthropicOutputConfig",
      "kind": "LinkedField",
      "name": "outputConfig",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "effort",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "thinking",
      "plural": false,
      "selections": [
        (v28/*: any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "disabled",
              "storageKey": null
            }
          ],
          "type": "PromptAnthropicThinkingDisabled",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "budgetTokens",
              "storageKey": null
            },
            {
              "alias": "enabledDisplay",
              "args": null,
              "kind": "ScalarField",
              "name": "display",
              "storageKey": null
            }
          ],
          "type": "PromptAnthropicThinkingEnabled",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": "adaptiveDisplay",
              "args": null,
              "kind": "ScalarField",
              "name": "display",
              "storageKey": null
            }
          ],
          "type": "PromptAnthropicThinkingAdaptive",
          "abstractKey": null
        }
      ],
      "storageKey": null
    },
    (v33/*: any*/)
  ],
  "type": "PromptAnthropicInvocationParameters",
  "abstractKey": null
},
v37 = {
  "kind": "InlineFragment",
  "selections": [
    (v29/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "maxOutputTokens",
      "storageKey": null
    },
    (v35/*: any*/),
    (v31/*: any*/),
    (v30/*: any*/),
    (v32/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "topK",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptGoogleThinkingConfig",
      "kind": "LinkedField",
      "name": "thinkingConfig",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "thinkingBudget",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "thinkingLevel",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "includeThoughts",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "PromptGoogleInvocationParameters",
  "abstractKey": null
},
v38 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "awsMaxTokens",
      "args": null,
      "kind": "ScalarField",
      "name": "maxTokens",
      "storageKey": null
    },
    (v29/*: any*/),
    (v32/*: any*/),
    (v35/*: any*/)
  ],
  "type": "PromptAwsInvocationParameters",
  "abstractKey": null
},
v39 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "baseUrl",
  "storageKey": null
},
v40 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "openaiApiType",
  "storageKey": null
},
v41 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "azureEndpoint",
  "storageKey": null
},
v42 = [
  (v28/*: any*/),
  (v39/*: any*/)
],
v43 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "regionName",
  "storageKey": null
},
v44 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endpointUrl",
  "storageKey": null
},
v45 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "errorsAfter"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "errorsFirst"
  }
],
v46 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "workItem",
  "plural": false,
  "selections": [
    (v28/*: any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "datasetExampleId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "repetitionNumber",
          "storageKey": null
        }
      ],
      "type": "TaskWorkItemId",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "experimentRunId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "datasetEvaluatorId",
          "storageKey": null
        }
      ],
      "type": "EvalWorkItemId",
      "abstractKey": null
    }
  ],
  "storageKey": null
},
v47 = [
  (v39/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentDetailsDialogQuery",
    "selections": [
      {
        "alias": "experiment",
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/),
              (v13/*: any*/),
              (v14/*: any*/),
              (v15/*: any*/),
              (v16/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v17/*: any*/),
                  (v18/*: any*/)
                ],
                "storageKey": null
              },
              (v20/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentJob",
                "kind": "LinkedField",
                "name": "job",
                "plural": false,
                "selections": [
                  (v21/*: any*/),
                  (v8/*: any*/),
                  (v22/*: any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "ExperimentDetailsDialog_jobErrors"
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptTaskConfig",
                    "kind": "LinkedField",
                    "name": "taskConfig",
                    "plural": false,
                    "selections": [
                      (v4/*: any*/),
                      (v23/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptConfig",
                        "kind": "LinkedField",
                        "name": "prompt",
                        "plural": false,
                        "selections": [
                          (v24/*: any*/),
                          (v25/*: any*/),
                          (v26/*: any*/),
                          (v27/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "invocationParameters",
                            "plural": false,
                            "selections": [
                              {
                                "kind": "InlineDataFragmentSpread",
                                "name": "PromptInvocationParametersReadableFragment",
                                "selections": [
                                  (v28/*: any*/),
                                  (v34/*: any*/),
                                  (v36/*: any*/),
                                  (v37/*: any*/),
                                  (v38/*: any*/)
                                ],
                                "args": null,
                                "argumentDefinitions": []
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
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "connection",
                        "plural": false,
                        "selections": [
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v28/*: any*/),
                              (v39/*: any*/),
                              (v40/*: any*/)
                            ],
                            "type": "OpenAIConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v28/*: any*/),
                              (v41/*: any*/),
                              (v40/*: any*/)
                            ],
                            "type": "AzureOpenAIConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v42/*: any*/),
                            "type": "AnthropicConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v28/*: any*/),
                              (v43/*: any*/),
                              (v44/*: any*/)
                            ],
                            "type": "AWSBedrockConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v42/*: any*/),
                            "type": "GoogleGenAIConnectionConfig",
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
            "type": "Experiment",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "ExperimentDetailsDialogQuery",
    "selections": [
      {
        "alias": "experiment",
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v28/*: any*/),
          (v4/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/),
              (v13/*: any*/),
              (v14/*: any*/),
              (v15/*: any*/),
              (v16/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v17/*: any*/),
                  (v18/*: any*/),
                  (v4/*: any*/)
                ],
                "storageKey": null
              },
              (v20/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentJob",
                "kind": "LinkedField",
                "name": "job",
                "plural": false,
                "selections": [
                  (v21/*: any*/),
                  (v8/*: any*/),
                  (v22/*: any*/),
                  {
                    "alias": null,
                    "args": (v45/*: any*/),
                    "concreteType": "ExperimentLogConnection",
                    "kind": "LinkedField",
                    "name": "errors",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExperimentLogEdge",
                        "kind": "LinkedField",
                        "name": "edges",
                        "plural": true,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentLog",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": [
                              (v4/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "occurredAt",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "category",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "message",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "detail",
                                "plural": false,
                                "selections": [
                                  (v28/*: any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "errorType",
                                        "storageKey": null
                                      },
                                      (v46/*: any*/)
                                    ],
                                    "type": "FailureDetail",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "retryCount",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "reason",
                                        "storageKey": null
                                      },
                                      (v46/*: any*/)
                                    ],
                                    "type": "RetriesExhaustedDetail",
                                    "abstractKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              (v28/*: any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "cursor",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PageInfo",
                        "kind": "LinkedField",
                        "name": "pageInfo",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "hasNextPage",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "endCursor",
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
                    "args": (v45/*: any*/),
                    "filters": null,
                    "handle": "connection",
                    "key": "ExperimentDetailsDialog_errors",
                    "kind": "LinkedHandle",
                    "name": "errors"
                  },
                  (v4/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptTaskConfig",
                    "kind": "LinkedField",
                    "name": "taskConfig",
                    "plural": false,
                    "selections": [
                      (v4/*: any*/),
                      (v23/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptConfig",
                        "kind": "LinkedField",
                        "name": "prompt",
                        "plural": false,
                        "selections": [
                          (v24/*: any*/),
                          (v25/*: any*/),
                          (v26/*: any*/),
                          (v27/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "invocationParameters",
                            "plural": false,
                            "selections": [
                              (v28/*: any*/),
                              {
                                "kind": "TypeDiscriminator",
                                "abstractKey": "__isPromptInvocationParameters"
                              },
                              (v34/*: any*/),
                              (v36/*: any*/),
                              (v37/*: any*/),
                              (v38/*: any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "connection",
                        "plural": false,
                        "selections": [
                          (v28/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v39/*: any*/),
                              (v40/*: any*/)
                            ],
                            "type": "OpenAIConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v41/*: any*/),
                              (v40/*: any*/)
                            ],
                            "type": "AzureOpenAIConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v47/*: any*/),
                            "type": "AnthropicConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v43/*: any*/),
                              (v44/*: any*/)
                            ],
                            "type": "AWSBedrockConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v47/*: any*/),
                            "type": "GoogleGenAIConnectionConfig",
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
            "type": "Experiment",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "d81effb76b17da7f7d6ed14c59ffc1b7",
    "id": null,
    "metadata": {},
    "name": "ExperimentDetailsDialogQuery",
    "operationKind": "query",
    "text": "query ExperimentDetailsDialogQuery(\n  $experimentId: ID!\n  $errorsFirst: Int = 20\n  $errorsAfter: String = null\n) {\n  experiment: node(id: $experimentId) {\n    __typename\n    ... on Experiment {\n      id\n      name\n      description\n      sequenceNumber\n      createdAt\n      updatedAt\n      metadata\n      repetitions\n      errorRate\n      runCount\n      expectedRunCount\n      averageRunLatencyMs\n      project {\n        id\n      }\n      user {\n        username\n        profilePictureUrl\n        id\n      }\n      costSummary {\n        total {\n          tokens\n          cost\n        }\n        prompt {\n          tokens\n          cost\n        }\n        completion {\n          tokens\n          cost\n        }\n      }\n      job {\n        status\n        createdAt\n        maxConcurrency\n        ...ExperimentDetailsDialog_jobErrors\n        taskConfig {\n          id\n          streamModelOutput\n          prompt {\n            modelProvider\n            modelName\n            templateType\n            templateFormat\n            invocationParameters {\n              __typename\n              ...PromptInvocationParametersReadableFragment\n            }\n          }\n          connection {\n            __typename\n            ... on OpenAIConnectionConfig {\n              __typename\n              baseUrl\n              openaiApiType\n            }\n            ... on AzureOpenAIConnectionConfig {\n              __typename\n              azureEndpoint\n              openaiApiType\n            }\n            ... on AnthropicConnectionConfig {\n              __typename\n              baseUrl\n            }\n            ... on AWSBedrockConnectionConfig {\n              __typename\n              regionName\n              endpointUrl\n            }\n            ... on GoogleGenAIConnectionConfig {\n              __typename\n              baseUrl\n            }\n          }\n        }\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment ExperimentDetailsDialog_jobErrors on ExperimentJob {\n  errors(first: $errorsFirst, after: $errorsAfter) {\n    edges {\n      node {\n        id\n        occurredAt\n        category\n        message\n        detail {\n          __typename\n          ... on FailureDetail {\n            errorType\n            workItem {\n              __typename\n              ... on TaskWorkItemId {\n                datasetExampleId\n                repetitionNumber\n              }\n              ... on EvalWorkItemId {\n                experimentRunId\n                datasetEvaluatorId\n              }\n            }\n          }\n          ... on RetriesExhaustedDetail {\n            retryCount\n            reason\n            workItem {\n              __typename\n              ... on TaskWorkItemId {\n                datasetExampleId\n                repetitionNumber\n              }\n              ... on EvalWorkItemId {\n                experimentRunId\n                datasetEvaluatorId\n              }\n            }\n          }\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  id\n}\n\nfragment PromptInvocationParametersReadableFragment on PromptInvocationParameters {\n  __isPromptInvocationParameters: __typename\n  __typename\n  ... on PromptOpenAIInvocationParameters {\n    temperature\n    openaiMaxTokens: maxTokens\n    maxCompletionTokens\n    frequencyPenalty\n    presencePenalty\n    topP\n    seed\n    stop\n    reasoningEffort\n    extraBody\n  }\n  ... on PromptAnthropicInvocationParameters {\n    anthropicMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n    outputConfig {\n      effort\n    }\n    thinking {\n      __typename\n      ... on PromptAnthropicThinkingDisabled {\n        disabled\n      }\n      ... on PromptAnthropicThinkingEnabled {\n        budgetTokens\n        enabledDisplay: display\n      }\n      ... on PromptAnthropicThinkingAdaptive {\n        adaptiveDisplay: display\n      }\n    }\n    extraBody\n  }\n  ... on PromptGoogleInvocationParameters {\n    temperature\n    maxOutputTokens\n    stopSequences\n    presencePenalty\n    frequencyPenalty\n    topP\n    topK\n    thinkingConfig {\n      thinkingBudget\n      thinkingLevel\n      includeThoughts\n    }\n  }\n  ... on PromptAwsInvocationParameters {\n    awsMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n  }\n}\n"
  }
};
})();

(node as any).hash = "495ef774e83143eb72c1e774aacbb712";

export default node;
