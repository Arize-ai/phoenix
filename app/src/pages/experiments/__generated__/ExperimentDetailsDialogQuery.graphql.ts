/**
 * @generated SignedSource<<0588faa11f9abaaccf4f6fc350a73cd5>>
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
          readonly invocationParameters: any;
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
  "concreteType": "PromptConfig",
  "kind": "LinkedField",
  "name": "prompt",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "modelProvider",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "modelName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "templateType",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "templateFormat",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "invocationParameters",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "baseUrl",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "openaiApiType",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "azureEndpoint",
  "storageKey": null
},
v29 = [
  (v25/*: any*/),
  (v26/*: any*/)
],
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "regionName",
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endpointUrl",
  "storageKey": null
},
v32 = [
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
v33 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "workItem",
  "plural": false,
  "selections": [
    (v25/*: any*/),
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
v34 = [
  (v26/*: any*/)
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
                      (v24/*: any*/),
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
                              (v25/*: any*/),
                              (v26/*: any*/),
                              (v27/*: any*/)
                            ],
                            "type": "OpenAIConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v25/*: any*/),
                              (v28/*: any*/),
                              (v27/*: any*/)
                            ],
                            "type": "AzureOpenAIConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v29/*: any*/),
                            "type": "AnthropicConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v25/*: any*/),
                              (v30/*: any*/),
                              (v31/*: any*/)
                            ],
                            "type": "AWSBedrockConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v29/*: any*/),
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
          (v25/*: any*/),
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
                    "args": (v32/*: any*/),
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
                                  (v25/*: any*/),
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
                                      (v33/*: any*/)
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
                                      (v33/*: any*/)
                                    ],
                                    "type": "RetriesExhaustedDetail",
                                    "abstractKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              (v25/*: any*/)
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
                    "args": (v32/*: any*/),
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
                      (v24/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "connection",
                        "plural": false,
                        "selections": [
                          (v25/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v26/*: any*/),
                              (v27/*: any*/)
                            ],
                            "type": "OpenAIConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v28/*: any*/),
                              (v27/*: any*/)
                            ],
                            "type": "AzureOpenAIConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v34/*: any*/),
                            "type": "AnthropicConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v30/*: any*/),
                              (v31/*: any*/)
                            ],
                            "type": "AWSBedrockConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v34/*: any*/),
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
    "cacheID": "89182e945abdd7d2ebbef80af29a65ef",
    "id": null,
    "metadata": {},
    "name": "ExperimentDetailsDialogQuery",
    "operationKind": "query",
    "text": "query ExperimentDetailsDialogQuery(\n  $experimentId: ID!\n  $errorsFirst: Int = 20\n  $errorsAfter: String = null\n) {\n  experiment: node(id: $experimentId) {\n    __typename\n    ... on Experiment {\n      id\n      name\n      description\n      sequenceNumber\n      createdAt\n      updatedAt\n      metadata\n      repetitions\n      errorRate\n      runCount\n      expectedRunCount\n      averageRunLatencyMs\n      project {\n        id\n      }\n      user {\n        username\n        profilePictureUrl\n        id\n      }\n      costSummary {\n        total {\n          tokens\n          cost\n        }\n        prompt {\n          tokens\n          cost\n        }\n        completion {\n          tokens\n          cost\n        }\n      }\n      job {\n        status\n        createdAt\n        maxConcurrency\n        ...ExperimentDetailsDialog_jobErrors\n        taskConfig {\n          id\n          streamModelOutput\n          prompt {\n            modelProvider\n            modelName\n            templateType\n            templateFormat\n            invocationParameters\n          }\n          connection {\n            __typename\n            ... on OpenAIConnectionConfig {\n              __typename\n              baseUrl\n              openaiApiType\n            }\n            ... on AzureOpenAIConnectionConfig {\n              __typename\n              azureEndpoint\n              openaiApiType\n            }\n            ... on AnthropicConnectionConfig {\n              __typename\n              baseUrl\n            }\n            ... on AWSBedrockConnectionConfig {\n              __typename\n              regionName\n              endpointUrl\n            }\n            ... on GoogleGenAIConnectionConfig {\n              __typename\n              baseUrl\n            }\n          }\n        }\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment ExperimentDetailsDialog_jobErrors on ExperimentJob {\n  errors(first: $errorsFirst, after: $errorsAfter) {\n    edges {\n      node {\n        id\n        occurredAt\n        category\n        message\n        detail {\n          __typename\n          ... on FailureDetail {\n            errorType\n            workItem {\n              __typename\n              ... on TaskWorkItemId {\n                datasetExampleId\n                repetitionNumber\n              }\n              ... on EvalWorkItemId {\n                experimentRunId\n                datasetEvaluatorId\n              }\n            }\n          }\n          ... on RetriesExhaustedDetail {\n            retryCount\n            reason\n            workItem {\n              __typename\n              ... on TaskWorkItemId {\n                datasetExampleId\n                repetitionNumber\n              }\n              ... on EvalWorkItemId {\n                experimentRunId\n                datasetEvaluatorId\n              }\n            }\n          }\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "552242d197f501abb6b7ed120fc7a624";

export default node;
