/**
 * @generated SignedSource<<90db79410ceca10f7aac1accd23b6e01>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentJobStatus = "COMPLETED" | "ERROR" | "RUNNING" | "STOPPED";
export type ExperimentLogCategory = "EVAL" | "EXPERIMENT" | "TASK";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type PromptTemplateType = "CHAT" | "STRING";
export type ExperimentDetailsDialogQuery$variables = {
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
      readonly errors: {
        readonly edges: ReadonlyArray<{
          readonly node: {
            readonly category: ExperimentLogCategory;
            readonly detail: {
              readonly errorType?: string;
              readonly reason?: string;
              readonly retryCount?: number;
              readonly stackTrace?: string | null;
            } | null;
            readonly id: string;
            readonly message: string;
            readonly occurredAt: string;
          };
        }>;
      };
      readonly lastError: {
        readonly category: ExperimentLogCategory;
        readonly detail: {
          readonly errorType?: string;
          readonly reason?: string;
          readonly retryCount?: number;
          readonly stackTrace?: string | null;
        } | null;
        readonly id: string;
        readonly message: string;
        readonly occurredAt: string;
      } | null;
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
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "experimentId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sequenceNumber",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "repetitions",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "errorRate",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "runCount",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "expectedRunCount",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "averageRunLatencyMs",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": [
    (v2/*: any*/)
  ],
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v17 = [
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
v18 = {
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
      "selections": (v17/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "prompt",
      "plural": false,
      "selections": (v17/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "completion",
      "plural": false,
      "selections": (v17/*: any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxConcurrency",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "occurredAt",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "category",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "message",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stackTrace",
  "storageKey": null
},
v25 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "errorType",
      "storageKey": null
    },
    (v24/*: any*/)
  ],
  "type": "FailureDetail",
  "abstractKey": null
},
v26 = {
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
    (v24/*: any*/)
  ],
  "type": "RetriesExhaustedDetail",
  "abstractKey": null
},
v27 = [
  (v2/*: any*/),
  (v21/*: any*/),
  (v22/*: any*/),
  (v23/*: any*/),
  {
    "alias": null,
    "args": null,
    "concreteType": null,
    "kind": "LinkedField",
    "name": "detail",
    "plural": false,
    "selections": [
      (v25/*: any*/),
      (v26/*: any*/)
    ],
    "storageKey": null
  }
],
v28 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 20
  }
],
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "streamModelOutput",
  "storageKey": null
},
v30 = {
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
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "baseUrl",
  "storageKey": null
},
v33 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "openaiApiType",
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "azureEndpoint",
  "storageKey": null
},
v35 = [
  (v31/*: any*/),
  (v32/*: any*/)
],
v36 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "regionName",
  "storageKey": null
},
v37 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endpointUrl",
  "storageKey": null
},
v38 = [
  (v2/*: any*/),
  (v21/*: any*/),
  (v22/*: any*/),
  (v23/*: any*/),
  {
    "alias": null,
    "args": null,
    "concreteType": null,
    "kind": "LinkedField",
    "name": "detail",
    "plural": false,
    "selections": [
      (v31/*: any*/),
      (v25/*: any*/),
      (v26/*: any*/)
    ],
    "storageKey": null
  }
],
v39 = [
  (v32/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentDetailsDialogQuery",
    "selections": [
      {
        "alias": "experiment",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
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
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v15/*: any*/),
                  (v16/*: any*/)
                ],
                "storageKey": null
              },
              (v18/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentJob",
                "kind": "LinkedField",
                "name": "job",
                "plural": false,
                "selections": [
                  (v19/*: any*/),
                  (v6/*: any*/),
                  (v20/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentLog",
                    "kind": "LinkedField",
                    "name": "lastError",
                    "plural": false,
                    "selections": (v27/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": (v28/*: any*/),
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
                            "selections": (v27/*: any*/),
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": "errors(first:20)"
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptTaskConfig",
                    "kind": "LinkedField",
                    "name": "taskConfig",
                    "plural": false,
                    "selections": [
                      (v2/*: any*/),
                      (v29/*: any*/),
                      (v30/*: any*/),
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
                              (v31/*: any*/),
                              (v32/*: any*/),
                              (v33/*: any*/)
                            ],
                            "type": "OpenAIConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v31/*: any*/),
                              (v34/*: any*/),
                              (v33/*: any*/)
                            ],
                            "type": "AzureOpenAIConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v35/*: any*/),
                            "type": "AnthropicConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v31/*: any*/),
                              (v36/*: any*/),
                              (v37/*: any*/)
                            ],
                            "type": "AWSBedrockConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v35/*: any*/),
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExperimentDetailsDialogQuery",
    "selections": [
      {
        "alias": "experiment",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v31/*: any*/),
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
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
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v15/*: any*/),
                  (v16/*: any*/),
                  (v2/*: any*/)
                ],
                "storageKey": null
              },
              (v18/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentJob",
                "kind": "LinkedField",
                "name": "job",
                "plural": false,
                "selections": [
                  (v19/*: any*/),
                  (v6/*: any*/),
                  (v20/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentLog",
                    "kind": "LinkedField",
                    "name": "lastError",
                    "plural": false,
                    "selections": (v38/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": (v28/*: any*/),
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
                            "selections": (v38/*: any*/),
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": "errors(first:20)"
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptTaskConfig",
                    "kind": "LinkedField",
                    "name": "taskConfig",
                    "plural": false,
                    "selections": [
                      (v2/*: any*/),
                      (v29/*: any*/),
                      (v30/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "connection",
                        "plural": false,
                        "selections": [
                          (v31/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v32/*: any*/),
                              (v33/*: any*/)
                            ],
                            "type": "OpenAIConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v34/*: any*/),
                              (v33/*: any*/)
                            ],
                            "type": "AzureOpenAIConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v39/*: any*/),
                            "type": "AnthropicConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v36/*: any*/),
                              (v37/*: any*/)
                            ],
                            "type": "AWSBedrockConnectionConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": (v39/*: any*/),
                            "type": "GoogleGenAIConnectionConfig",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  (v2/*: any*/)
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
    "cacheID": "de83bbba325c6154eeb39ab1767ce857",
    "id": null,
    "metadata": {},
    "name": "ExperimentDetailsDialogQuery",
    "operationKind": "query",
    "text": "query ExperimentDetailsDialogQuery(\n  $experimentId: ID!\n) {\n  experiment: node(id: $experimentId) {\n    __typename\n    ... on Experiment {\n      id\n      name\n      description\n      sequenceNumber\n      createdAt\n      updatedAt\n      metadata\n      repetitions\n      errorRate\n      runCount\n      expectedRunCount\n      averageRunLatencyMs\n      project {\n        id\n      }\n      user {\n        username\n        profilePictureUrl\n        id\n      }\n      costSummary {\n        total {\n          tokens\n          cost\n        }\n        prompt {\n          tokens\n          cost\n        }\n        completion {\n          tokens\n          cost\n        }\n      }\n      job {\n        status\n        createdAt\n        maxConcurrency\n        lastError {\n          id\n          occurredAt\n          category\n          message\n          detail {\n            __typename\n            ... on FailureDetail {\n              errorType\n              stackTrace\n            }\n            ... on RetriesExhaustedDetail {\n              retryCount\n              reason\n              stackTrace\n            }\n          }\n        }\n        errors(first: 20) {\n          edges {\n            node {\n              id\n              occurredAt\n              category\n              message\n              detail {\n                __typename\n                ... on FailureDetail {\n                  errorType\n                  stackTrace\n                }\n                ... on RetriesExhaustedDetail {\n                  retryCount\n                  reason\n                  stackTrace\n                }\n              }\n            }\n          }\n        }\n        taskConfig {\n          id\n          streamModelOutput\n          prompt {\n            modelProvider\n            modelName\n            templateType\n            templateFormat\n            invocationParameters\n          }\n          connection {\n            __typename\n            ... on OpenAIConnectionConfig {\n              __typename\n              baseUrl\n              openaiApiType\n            }\n            ... on AzureOpenAIConnectionConfig {\n              __typename\n              azureEndpoint\n              openaiApiType\n            }\n            ... on AnthropicConnectionConfig {\n              __typename\n              baseUrl\n            }\n            ... on AWSBedrockConnectionConfig {\n              __typename\n              regionName\n              endpointUrl\n            }\n            ... on GoogleGenAIConnectionConfig {\n              __typename\n              baseUrl\n            }\n          }\n        }\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "3d4139b38261795eb5bd76b29fb2e437";

export default node;
