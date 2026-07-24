/**
 * @generated SignedSource<<b8a4d8ec629ce2d1390a511733acdf30>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type InternetAccessMode = "BOOLEAN" | "NONE";
export type SandboxBackendType = "DAYTONA" | "DENO" | "E2B" | "MODAL" | "TENKI" | "VERCEL" | "WASM";
export type datasetEvaluatorDetailsLoaderQuery$variables = {
  datasetEvaluatorId: string;
  datasetId: string;
};
export type datasetEvaluatorDetailsLoaderQuery$data = {
  readonly dataset: {
    readonly datasetEvaluator?: {
      readonly description: string | null;
      readonly evaluator: {
        readonly __typename: string;
        readonly description: string | null;
        readonly kind: EvaluatorKind;
        readonly versionCount?: number;
      };
      readonly id: string;
      readonly name: string;
      readonly project: {
        readonly id: string;
      };
      readonly " $fragmentSpreads": FragmentRefs<"BuiltInDatasetEvaluatorDetails_datasetEvaluator" | "CodeDatasetEvaluatorDetails_datasetEvaluator" | "LLMDatasetEvaluatorDetails_datasetEvaluator">;
    };
    readonly id: string;
  };
  readonly sandboxBackends: ReadonlyArray<{
    readonly backendType: SandboxBackendType;
    readonly displayName: string;
    readonly internetAccess: InternetAccessMode;
    readonly supportsDependencies: boolean;
    readonly supportsEnvVars: boolean;
  }>;
};
export type datasetEvaluatorDetailsLoaderQuery = {
  response: datasetEvaluatorDetailsLoaderQuery$data;
  variables: datasetEvaluatorDetailsLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetEvaluatorId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = [
  {
    "kind": "Variable",
    "name": "datasetEvaluatorId",
    "variableName": "datasetEvaluatorId"
  }
],
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
  "name": "__typename",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "versionCount",
  "storageKey": null
},
v10 = [
  (v3/*:: as any*/)
],
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": (v10/*:: as any*/),
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxBackendInfo",
  "kind": "LinkedField",
  "name": "sandboxBackends",
  "plural": true,
  "selections": [
    (v12/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "displayName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "supportsEnvVars",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "internetAccess",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "supportsDependencies",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v15 = {
  "kind": "InlineFragment",
  "selections": [
    (v5/*:: as any*/),
    (v14/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "CategoricalAnnotationValue",
      "kind": "LinkedField",
      "name": "values",
      "plural": true,
      "selections": [
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "CategoricalAnnotationConfig",
  "abstractKey": null
},
v16 = {
  "kind": "InlineFragment",
  "selections": [
    (v5/*:: as any*/),
    (v14/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lowerBound",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "upperBound",
      "storageKey": null
    }
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v17 = {
  "kind": "InlineFragment",
  "selections": [
    (v5/*:: as any*/),
    (v14/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "threshold",
      "storageKey": null
    }
  ],
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
},
v18 = {
  "kind": "InlineFragment",
  "selections": (v10/*:: as any*/),
  "type": "Node",
  "abstractKey": "__isNode"
},
v19 = [
  (v3/*:: as any*/),
  (v5/*:: as any*/)
],
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "strict",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "temperature",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frequencyPenalty",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "presencePenalty",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "topP",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "extraBody",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "datasetEvaluatorDetailsLoaderQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v4/*:: as any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v7/*:: as any*/),
                      (v8/*:: as any*/),
                      (v6/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v9/*:: as any*/)
                        ],
                        "type": "CodeEvaluator",
                        "abstractKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  (v11/*:: as any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "BuiltInDatasetEvaluatorDetails_datasetEvaluator"
                  },
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "CodeDatasetEvaluatorDetails_datasetEvaluator"
                  },
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "LLMDatasetEvaluatorDetails_datasetEvaluator"
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      (v13/*:: as any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "datasetEvaluatorDetailsLoaderQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v4/*:: as any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v7/*:: as any*/),
                      (v8/*:: as any*/),
                      (v6/*:: as any*/),
                      (v3/*:: as any*/),
                      (v5/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v9/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "language",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "outputConfigs",
                            "plural": true,
                            "selections": [
                              (v7/*:: as any*/),
                              (v15/*:: as any*/),
                              (v16/*:: as any*/),
                              (v17/*:: as any*/),
                              (v18/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SandboxConfig",
                            "kind": "LinkedField",
                            "name": "sandboxConfig",
                            "plural": false,
                            "selections": [
                              (v3/*:: as any*/),
                              (v5/*:: as any*/),
                              (v6/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "timeout",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SandboxConfigData",
                                "kind": "LinkedField",
                                "name": "config",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "SandboxConfigEnvVar",
                                    "kind": "LinkedField",
                                    "name": "envVars",
                                    "plural": true,
                                    "selections": [
                                      (v5/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "secretKey",
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "SandboxConfigInternetAccess",
                                    "kind": "LinkedField",
                                    "name": "internetAccess",
                                    "plural": false,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "mode",
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "SandboxConfigDependencies",
                                    "kind": "LinkedField",
                                    "name": "dependencies",
                                    "plural": false,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "packages",
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
                                "concreteType": "SandboxProvider",
                                "kind": "LinkedField",
                                "name": "provider",
                                "plural": false,
                                "selections": [
                                  (v12/*:: as any*/),
                                  (v3/*:: as any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "CodeEvaluatorVersion",
                            "kind": "LinkedField",
                            "name": "currentVersion",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "sourceCode",
                                "storageKey": null
                              },
                              (v3/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "CodeEvaluator",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "outputConfigs",
                            "plural": true,
                            "selections": [
                              (v7/*:: as any*/),
                              (v15/*:: as any*/),
                              (v16/*:: as any*/),
                              (v18/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "BuiltInEvaluator",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Prompt",
                            "kind": "LinkedField",
                            "name": "prompt",
                            "plural": false,
                            "selections": (v19/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersion",
                            "kind": "LinkedField",
                            "name": "promptVersion",
                            "plural": false,
                            "selections": [
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
                                "name": "modelProvider",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "PromptTools",
                                "kind": "LinkedField",
                                "name": "tools",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "tools",
                                    "plural": true,
                                    "selections": [
                                      (v7/*:: as any*/),
                                      {
                                        "kind": "InlineFragment",
                                        "selections": [
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": "PromptToolFunctionDefinition",
                                            "kind": "LinkedField",
                                            "name": "function",
                                            "plural": false,
                                            "selections": [
                                              {
                                                "alias": null,
                                                "args": null,
                                                "kind": "ScalarField",
                                                "name": "parameters",
                                                "storageKey": null
                                              },
                                              (v5/*:: as any*/),
                                              (v6/*:: as any*/),
                                              (v20/*:: as any*/)
                                            ],
                                            "storageKey": null
                                          }
                                        ],
                                        "type": "PromptToolFunction",
                                        "abstractKey": null
                                      },
                                      {
                                        "kind": "InlineFragment",
                                        "selections": [
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "raw",
                                            "storageKey": null
                                          }
                                        ],
                                        "type": "PromptToolRaw",
                                        "abstractKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "PromptToolChoice",
                                    "kind": "LinkedField",
                                    "name": "toolChoice",
                                    "plural": false,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "type",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "functionName",
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "disableParallelToolCalls",
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              (v3/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "invocationParameters",
                                "plural": false,
                                "selections": [
                                  (v7/*:: as any*/),
                                  {
                                    "kind": "TypeDiscriminator",
                                    "abstractKey": "__isPromptInvocationParameters"
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v21/*:: as any*/),
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
                                      (v22/*:: as any*/),
                                      (v23/*:: as any*/),
                                      (v24/*:: as any*/),
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
                                      (v25/*:: as any*/)
                                    ],
                                    "type": "PromptOpenAIInvocationParameters",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": "anthropicMaxTokens",
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "maxTokens",
                                        "storageKey": null
                                      },
                                      (v21/*:: as any*/),
                                      (v24/*:: as any*/),
                                      (v26/*:: as any*/),
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
                                          (v7/*:: as any*/),
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
                                      (v25/*:: as any*/)
                                    ],
                                    "type": "PromptAnthropicInvocationParameters",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v21/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "maxOutputTokens",
                                        "storageKey": null
                                      },
                                      (v26/*:: as any*/),
                                      (v23/*:: as any*/),
                                      (v22/*:: as any*/),
                                      (v24/*:: as any*/),
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
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": "awsMaxTokens",
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "maxTokens",
                                        "storageKey": null
                                      },
                                      (v21/*:: as any*/),
                                      (v24/*:: as any*/),
                                      (v26/*:: as any*/)
                                    ],
                                    "type": "PromptAwsInvocationParameters",
                                    "abstractKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "GenerativeModelCustomProvider",
                                "kind": "LinkedField",
                                "name": "customProvider",
                                "plural": false,
                                "selections": (v19/*:: as any*/),
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "PromptResponseFormatJSONSchema",
                                "kind": "LinkedField",
                                "name": "responseFormat",
                                "plural": false,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "PromptResponseFormatJSONSchemaDefinition",
                                    "kind": "LinkedField",
                                    "name": "jsonSchema",
                                    "plural": false,
                                    "selections": [
                                      (v5/*:: as any*/),
                                      (v6/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "schema",
                                        "storageKey": null
                                      },
                                      (v20/*:: as any*/)
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
                                "name": "template",
                                "plural": false,
                                "selections": [
                                  (v7/*:: as any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "PromptMessage",
                                        "kind": "LinkedField",
                                        "name": "messages",
                                        "plural": true,
                                        "selections": [
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "role",
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": null,
                                            "kind": "LinkedField",
                                            "name": "content",
                                            "plural": true,
                                            "selections": [
                                              (v7/*:: as any*/),
                                              {
                                                "kind": "InlineFragment",
                                                "selections": [
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "concreteType": "TextContentValue",
                                                    "kind": "LinkedField",
                                                    "name": "text",
                                                    "plural": false,
                                                    "selections": [
                                                      {
                                                        "alias": null,
                                                        "args": null,
                                                        "kind": "ScalarField",
                                                        "name": "text",
                                                        "storageKey": null
                                                      }
                                                    ],
                                                    "storageKey": null
                                                  }
                                                ],
                                                "type": "TextContentPart",
                                                "abstractKey": null
                                              },
                                              {
                                                "kind": "InlineFragment",
                                                "selections": [
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "concreteType": "ToolCallContentValue",
                                                    "kind": "LinkedField",
                                                    "name": "toolCall",
                                                    "plural": false,
                                                    "selections": [
                                                      (v27/*:: as any*/),
                                                      {
                                                        "alias": null,
                                                        "args": null,
                                                        "concreteType": "ToolCallFunction",
                                                        "kind": "LinkedField",
                                                        "name": "toolCall",
                                                        "plural": false,
                                                        "selections": [
                                                          (v5/*:: as any*/),
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
                                                  }
                                                ],
                                                "type": "ToolCallContentPart",
                                                "abstractKey": null
                                              },
                                              {
                                                "kind": "InlineFragment",
                                                "selections": [
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "concreteType": "ToolResultContentValue",
                                                    "kind": "LinkedField",
                                                    "name": "toolResult",
                                                    "plural": false,
                                                    "selections": [
                                                      (v27/*:: as any*/),
                                                      {
                                                        "alias": null,
                                                        "args": null,
                                                        "kind": "ScalarField",
                                                        "name": "result",
                                                        "storageKey": null
                                                      }
                                                    ],
                                                    "storageKey": null
                                                  }
                                                ],
                                                "type": "ToolResultContentPart",
                                                "abstractKey": null
                                              }
                                            ],
                                            "storageKey": null
                                          }
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "PromptChatTemplate",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "template",
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "PromptStringTemplate",
                                    "abstractKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": "provider",
                                "args": null,
                                "kind": "ScalarField",
                                "name": "modelProvider",
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
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersionTag",
                            "kind": "LinkedField",
                            "name": "promptVersionTag",
                            "plural": false,
                            "selections": [
                              (v5/*:: as any*/),
                              (v3/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "LLMEvaluator",
                        "abstractKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  (v11/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EvaluatorInputMapping",
                    "kind": "LinkedField",
                    "name": "inputMapping",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "literalMapping",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "pathMapping",
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
                    "name": "outputConfigs",
                    "plural": true,
                    "selections": [
                      (v7/*:: as any*/),
                      (v15/*:: as any*/),
                      (v16/*:: as any*/),
                      (v18/*:: as any*/),
                      (v17/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      (v13/*:: as any*/)
    ]
  },
  "params": {
    "cacheID": "499aada69dbbcf11e7afb1feb080db83",
    "id": null,
    "metadata": {},
    "name": "datasetEvaluatorDetailsLoaderQuery",
    "operationKind": "query",
    "text": "query datasetEvaluatorDetailsLoaderQuery(\n  $datasetId: ID!\n  $datasetEvaluatorId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      id\n      datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {\n        id\n        name\n        description\n        evaluator {\n          __typename\n          kind\n          description\n          ... on CodeEvaluator {\n            versionCount\n          }\n          id\n        }\n        project {\n          id\n        }\n        ...BuiltInDatasetEvaluatorDetails_datasetEvaluator\n        ...CodeDatasetEvaluatorDetails_datasetEvaluator\n        ...LLMDatasetEvaluatorDetails_datasetEvaluator\n      }\n    }\n  }\n  sandboxBackends {\n    backendType\n    displayName\n    supportsEnvVars\n    internetAccess\n    supportsDependencies\n  }\n}\n\nfragment BuiltInDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {\n  id\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  evaluator {\n    __typename\n    kind\n    name\n    ... on BuiltInEvaluator {\n      outputConfigs {\n        __typename\n        ... on CategoricalAnnotationConfig {\n          name\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          name\n          optimizationDirection\n          lowerBound\n          upperBound\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment CodeDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {\n  id\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on FreeformAnnotationConfig {\n      name\n      optimizationDirection\n      threshold\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  evaluator {\n    __typename\n    kind\n    ... on CodeEvaluator {\n      id\n      name\n      description\n      language\n      outputConfigs {\n        __typename\n        ... on CategoricalAnnotationConfig {\n          name\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          name\n          optimizationDirection\n          lowerBound\n          upperBound\n        }\n        ... on FreeformAnnotationConfig {\n          name\n          optimizationDirection\n          threshold\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n      sandboxConfig {\n        id\n        name\n        description\n        timeout\n        config {\n          envVars {\n            name\n            secretKey\n          }\n          internetAccess {\n            mode\n          }\n          dependencies {\n            packages\n          }\n        }\n        provider {\n          backendType\n          id\n        }\n      }\n      currentVersion {\n        sourceCode\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment LLMDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {\n  id\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  evaluator {\n    __typename\n    kind\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        tools {\n          tools {\n            __typename\n            ... on PromptToolFunction {\n              function {\n                parameters\n              }\n            }\n            ... on PromptToolRaw {\n              raw\n            }\n          }\n        }\n        ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n        ...PromptChatMessagesCard__main\n        id\n      }\n      promptVersionTag {\n        name\n        id\n      }\n    }\n    id\n  }\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n}\n\nfragment PromptChatMessagesCard__main on PromptVersion {\n  provider: modelProvider\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                arguments\n                name\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateType\n  templateFormat\n}\n\nfragment PromptInvocationParametersReadableFragment on PromptInvocationParameters {\n  __isPromptInvocationParameters: __typename\n  __typename\n  ... on PromptOpenAIInvocationParameters {\n    temperature\n    openaiMaxTokens: maxTokens\n    maxCompletionTokens\n    frequencyPenalty\n    presencePenalty\n    topP\n    seed\n    stop\n    reasoningEffort\n    extraBody\n  }\n  ... on PromptAnthropicInvocationParameters {\n    anthropicMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n    outputConfig {\n      effort\n    }\n    thinking {\n      __typename\n      ... on PromptAnthropicThinkingDisabled {\n        disabled\n      }\n      ... on PromptAnthropicThinkingEnabled {\n        budgetTokens\n        enabledDisplay: display\n      }\n      ... on PromptAnthropicThinkingAdaptive {\n        adaptiveDisplay: display\n      }\n    }\n    extraBody\n  }\n  ... on PromptGoogleInvocationParameters {\n    temperature\n    maxOutputTokens\n    stopSequences\n    presencePenalty\n    frequencyPenalty\n    topP\n    topK\n    thinkingConfig {\n      thinkingBudget\n      thinkingLevel\n      includeThoughts\n    }\n  }\n  ... on PromptAwsInvocationParameters {\n    awsMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n  }\n}\n\nfragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion {\n  id\n  modelName\n  modelProvider\n  invocationParameters {\n    __typename\n    ...PromptInvocationParametersReadableFragment\n  }\n  customProvider {\n    id\n    name\n  }\n  responseFormat {\n    jsonSchema {\n      name\n      description\n      schema\n      strict\n    }\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  tools {\n    tools {\n      __typename\n      ... on PromptToolFunction {\n        function {\n          name\n          description\n          parameters\n          strict\n        }\n      }\n      ... on PromptToolRaw {\n        raw\n      }\n    }\n    toolChoice {\n      type\n      functionName\n    }\n    disableParallelToolCalls\n  }\n}\n"
  }
};
})();

(node as any).hash = "d78faa24309a7adc5a5e99c9e3e17ca7";

export default node;
