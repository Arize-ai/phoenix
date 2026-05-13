/**
 * @generated SignedSource<<7c3291987986ab876fc1537b938ed21e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type InternetAccessMode = "ALLOWLIST" | "BOOLEAN" | "NONE";
export type Language = "PYTHON" | "TYPESCRIPT";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type datasetEvaluatorDetailsLoaderQuery$variables = {
  canManageSandboxes: boolean;
  datasetEvaluatorId: string;
  datasetId: string;
  orphanSpanAsRootSpan: boolean;
  timeRange?: TimeRange | null;
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
        readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorSpans_project">;
      };
      readonly " $fragmentSpreads": FragmentRefs<"BuiltInDatasetEvaluatorDetails_datasetEvaluator" | "CodeDatasetEvaluatorDetails_datasetEvaluator" | "LLMDatasetEvaluatorDetails_datasetEvaluator">;
    };
    readonly id: string;
  };
  readonly sandboxBackends?: ReadonlyArray<{
    readonly backendType: string;
    readonly dependenciesLanguage: Language | null;
    readonly displayName: string;
    readonly internetAccess: InternetAccessMode;
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
  "name": "canManageSandboxes"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetEvaluatorId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "orphanSpanAsRootSpan"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v5 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = [
  {
    "kind": "Variable",
    "name": "datasetEvaluatorId",
    "variableName": "datasetEvaluatorId"
  }
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "versionCount",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v14 = {
  "condition": "canManageSandboxes",
  "kind": "Condition",
  "passingValue": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "SandboxBackendInfo",
      "kind": "LinkedField",
      "name": "sandboxBackends",
      "plural": true,
      "selections": [
        (v13/*: any*/),
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
          "name": "dependenciesLanguage",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ]
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "language",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "concreteType": "CategoricalAnnotationValue",
  "kind": "LinkedField",
  "name": "values",
  "plural": true,
  "selections": [
    (v17/*: any*/),
    (v18/*: any*/)
  ],
  "storageKey": null
},
v20 = {
  "kind": "InlineFragment",
  "selections": [
    (v6/*: any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
},
v21 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v10/*: any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        (v8/*: any*/),
        (v16/*: any*/),
        (v19/*: any*/)
      ],
      "type": "CategoricalAnnotationConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v8/*: any*/),
        (v16/*: any*/),
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
    (v20/*: any*/)
  ],
  "storageKey": null
},
v22 = [
  (v6/*: any*/),
  (v8/*: any*/)
],
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "strict",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "temperature",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frequencyPenalty",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "presencePenalty",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "topP",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "extraBody",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v31 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 30
  },
  {
    "kind": "Variable",
    "name": "orphanSpanAsRootSpan",
    "variableName": "orphanSpanAsRootSpan"
  },
  {
    "kind": "Literal",
    "name": "rootSpansOnly",
    "value": true
  },
  {
    "kind": "Literal",
    "name": "sort",
    "value": {
      "col": "startTime",
      "dir": "desc"
    }
  },
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v32 = {
  "alias": null,
  "args": null,
  "concreteType": "LabelFraction",
  "kind": "LinkedField",
  "name": "labelFractions",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "fraction",
      "storageKey": null
    },
    (v17/*: any*/)
  ],
  "storageKey": null
},
v33 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "meanScore",
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": [
    (v6/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "AnnotationConfigConnection",
      "kind": "LinkedField",
      "name": "annotationConfigs",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "AnnotationConfigEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": null,
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v10/*: any*/),
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "annotationType",
                      "storageKey": null
                    }
                  ],
                  "type": "AnnotationConfigBase",
                  "abstractKey": "__isAnnotationConfigBase"
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v6/*: any*/),
                    (v8/*: any*/),
                    (v16/*: any*/),
                    (v19/*: any*/)
                  ],
                  "type": "CategoricalAnnotationConfig",
                  "abstractKey": null
                },
                (v20/*: any*/)
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
},
v35 = [
  (v6/*: any*/),
  (v8/*: any*/),
  (v17/*: any*/),
  (v18/*: any*/),
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
    "name": "createdAt",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "User",
    "kind": "LinkedField",
    "name": "user",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "username",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "profilePictureUrl",
        "storageKey": null
      },
      (v6/*: any*/)
    ],
    "storageKey": null
  }
],
v36 = [
  {
    "alias": "value",
    "args": null,
    "kind": "ScalarField",
    "name": "truncatedValue",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "datasetEvaluatorDetailsLoaderQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v5/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v7/*: any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v6/*: any*/),
                  (v8/*: any*/),
                  (v9/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v9/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v12/*: any*/)
                        ],
                        "type": "CodeEvaluator",
                        "abstractKey": null
                      }
                    ],
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
                      (v6/*: any*/),
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "DatasetEvaluatorSpans_project"
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "BuiltInDatasetEvaluatorDetails_datasetEvaluator"
                  },
                  {
                    "args": [
                      {
                        "kind": "Variable",
                        "name": "canManageSandboxes",
                        "variableName": "canManageSandboxes"
                      }
                    ],
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
      (v14/*: any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v1/*: any*/),
      (v4/*: any*/),
      (v3/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "datasetEvaluatorDetailsLoaderQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v5/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v10/*: any*/),
          (v6/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v7/*: any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v6/*: any*/),
                  (v8/*: any*/),
                  (v9/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v9/*: any*/),
                      (v6/*: any*/),
                      (v8/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v12/*: any*/),
                          (v15/*: any*/),
                          (v21/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SandboxConfig",
                            "kind": "LinkedField",
                            "name": "sandboxConfig",
                            "plural": false,
                            "selections": [
                              (v6/*: any*/),
                              (v8/*: any*/),
                              (v9/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "timeout",
                                "storageKey": null
                              },
                              {
                                "condition": "canManageSandboxes",
                                "kind": "Condition",
                                "passingValue": true,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "config",
                                    "storageKey": null
                                  }
                                ]
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SandboxProvider",
                                "kind": "LinkedField",
                                "name": "provider",
                                "plural": false,
                                "selections": [
                                  (v13/*: any*/),
                                  (v15/*: any*/),
                                  (v6/*: any*/)
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
                              (v6/*: any*/)
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
                          (v21/*: any*/)
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
                            "selections": (v22/*: any*/),
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
                                      (v10/*: any*/),
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
                                              (v8/*: any*/),
                                              (v9/*: any*/),
                                              (v23/*: any*/)
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
                              (v6/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "invocationParameters",
                                "plural": false,
                                "selections": [
                                  (v10/*: any*/),
                                  {
                                    "kind": "TypeDiscriminator",
                                    "abstractKey": "__isPromptInvocationParameters"
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v24/*: any*/),
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
                                      (v25/*: any*/),
                                      (v26/*: any*/),
                                      (v27/*: any*/),
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
                                      (v28/*: any*/)
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
                                      (v24/*: any*/),
                                      (v27/*: any*/),
                                      (v29/*: any*/),
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
                                          (v10/*: any*/),
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
                                      (v28/*: any*/)
                                    ],
                                    "type": "PromptAnthropicInvocationParameters",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v24/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "maxOutputTokens",
                                        "storageKey": null
                                      },
                                      (v29/*: any*/),
                                      (v26/*: any*/),
                                      (v25/*: any*/),
                                      (v27/*: any*/),
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
                                      (v24/*: any*/),
                                      (v27/*: any*/),
                                      (v29/*: any*/)
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
                                "selections": (v22/*: any*/),
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
                                      (v8/*: any*/),
                                      (v9/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "schema",
                                        "storageKey": null
                                      },
                                      (v23/*: any*/)
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
                                  (v10/*: any*/),
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
                                              (v10/*: any*/),
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
                                                      (v30/*: any*/),
                                                      {
                                                        "alias": null,
                                                        "args": null,
                                                        "concreteType": "ToolCallFunction",
                                                        "kind": "LinkedField",
                                                        "name": "toolCall",
                                                        "plural": false,
                                                        "selections": [
                                                          (v8/*: any*/),
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
                                                      (v30/*: any*/),
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
                              (v8/*: any*/),
                              (v6/*: any*/)
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
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Project",
                    "kind": "LinkedField",
                    "name": "project",
                    "plural": false,
                    "selections": [
                      (v6/*: any*/),
                      (v8/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "spanAnnotationNames",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "traceAnnotationsNames",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": (v31/*: any*/),
                        "concreteType": "SpanConnection",
                        "kind": "LinkedField",
                        "name": "spans",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SpanEdge",
                            "kind": "LinkedField",
                            "name": "edges",
                            "plural": true,
                            "selections": [
                              {
                                "alias": "span",
                                "args": null,
                                "concreteType": "Span",
                                "kind": "LinkedField",
                                "name": "node",
                                "plural": false,
                                "selections": [
                                  (v6/*: any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "spanKind",
                                    "storageKey": null
                                  },
                                  (v8/*: any*/),
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
                                    "name": "statusCode",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "startTime",
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
                                    "kind": "ScalarField",
                                    "name": "cumulativeTokenCountTotal",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "spanId",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "Trace",
                                    "kind": "LinkedField",
                                    "name": "trace",
                                    "plural": false,
                                    "selections": [
                                      (v6/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "traceId",
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
                                        "concreteType": "AnnotationSummary",
                                        "kind": "LinkedField",
                                        "name": "traceAnnotationSummaries",
                                        "plural": true,
                                        "selections": [
                                          (v32/*: any*/),
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "count",
                                            "storageKey": null
                                          },
                                          (v33/*: any*/),
                                          (v8/*: any*/)
                                        ],
                                        "storageKey": null
                                      },
                                      (v34/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "TraceAnnotation",
                                        "kind": "LinkedField",
                                        "name": "traceAnnotations",
                                        "plural": true,
                                        "selections": (v35/*: any*/),
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "SpanIOValue",
                                    "kind": "LinkedField",
                                    "name": "input",
                                    "plural": false,
                                    "selections": (v36/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "SpanIOValue",
                                    "kind": "LinkedField",
                                    "name": "output",
                                    "plural": false,
                                    "selections": (v36/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "SpanAnnotation",
                                    "kind": "LinkedField",
                                    "name": "spanAnnotations",
                                    "plural": true,
                                    "selections": (v35/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "AnnotationSummary",
                                    "kind": "LinkedField",
                                    "name": "spanAnnotationSummaries",
                                    "plural": true,
                                    "selections": [
                                      (v32/*: any*/),
                                      (v33/*: any*/),
                                      (v8/*: any*/)
                                    ],
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "DocumentRetrievalMetrics",
                                    "kind": "LinkedField",
                                    "name": "documentRetrievalMetrics",
                                    "plural": true,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "evaluationName",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "ndcg",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "precision",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "hit",
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  },
                                  (v34/*: any*/)
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "cursor",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Span",
                                "kind": "LinkedField",
                                "name": "node",
                                "plural": false,
                                "selections": [
                                  (v10/*: any*/),
                                  (v6/*: any*/)
                                ],
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
                                "name": "endCursor",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "hasNextPage",
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
                        "args": (v31/*: any*/),
                        "filters": [
                          "sort",
                          "rootSpansOnly",
                          "filterCondition",
                          "orphanSpanAsRootSpan",
                          "timeRange"
                        ],
                        "handle": "connection",
                        "key": "SpansTable_spans",
                        "kind": "LinkedHandle",
                        "name": "spans"
                      }
                    ],
                    "storageKey": null
                  },
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
                  (v21/*: any*/)
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
      (v14/*: any*/)
    ]
  },
  "params": {
    "cacheID": "018b476d66ec0259d1a07b62e94be7f8",
    "id": null,
    "metadata": {},
    "name": "datasetEvaluatorDetailsLoaderQuery",
    "operationKind": "query",
    "text": "query datasetEvaluatorDetailsLoaderQuery(\n  $datasetId: ID!\n  $datasetEvaluatorId: ID!\n  $timeRange: TimeRange\n  $orphanSpanAsRootSpan: Boolean!\n  $canManageSandboxes: Boolean!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      id\n      datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {\n        id\n        name\n        description\n        evaluator {\n          __typename\n          kind\n          description\n          ... on CodeEvaluator {\n            versionCount\n          }\n          id\n        }\n        project {\n          id\n          ...DatasetEvaluatorSpans_project\n        }\n        ...BuiltInDatasetEvaluatorDetails_datasetEvaluator\n        ...CodeDatasetEvaluatorDetails_datasetEvaluator_3c0q8F\n        ...LLMDatasetEvaluatorDetails_datasetEvaluator\n      }\n    }\n  }\n  sandboxBackends @include(if: $canManageSandboxes) {\n    backendType\n    displayName\n    supportsEnvVars\n    internetAccess\n    dependenciesLanguage\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  spanAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    createdAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  spanAnnotationSummaries {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment BuiltInDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {\n  id\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  evaluator {\n    __typename\n    kind\n    name\n    ... on BuiltInEvaluator {\n      outputConfigs {\n        __typename\n        ... on CategoricalAnnotationConfig {\n          name\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          name\n          optimizationDirection\n          lowerBound\n          upperBound\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment CodeDatasetEvaluatorDetails_datasetEvaluator_3c0q8F on DatasetEvaluator {\n  id\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  evaluator {\n    __typename\n    kind\n    ... on CodeEvaluator {\n      id\n      name\n      description\n      language\n      outputConfigs {\n        __typename\n        ... on CategoricalAnnotationConfig {\n          name\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          name\n          optimizationDirection\n          lowerBound\n          upperBound\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n      sandboxConfig {\n        id\n        name\n        description\n        timeout\n        config @include(if: $canManageSandboxes)\n        provider {\n          backendType\n          language\n          id\n        }\n      }\n      currentVersion {\n        sourceCode\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment DatasetEvaluatorSpans_project on Project {\n  id\n  ...SpansTable_spans\n}\n\nfragment LLMDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {\n  id\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  evaluator {\n    __typename\n    kind\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        tools {\n          tools {\n            __typename\n            ... on PromptToolFunction {\n              function {\n                parameters\n              }\n            }\n            ... on PromptToolRaw {\n              raw\n            }\n          }\n        }\n        ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n        ...PromptChatMessagesCard__main\n        id\n      }\n      promptVersionTag {\n        name\n        id\n      }\n    }\n    id\n  }\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n}\n\nfragment PromptChatMessagesCard__main on PromptVersion {\n  provider: modelProvider\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                arguments\n                name\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateType\n  templateFormat\n}\n\nfragment PromptInvocationParametersReadableFragment on PromptInvocationParameters {\n  __isPromptInvocationParameters: __typename\n  __typename\n  ... on PromptOpenAIInvocationParameters {\n    temperature\n    openaiMaxTokens: maxTokens\n    maxCompletionTokens\n    frequencyPenalty\n    presencePenalty\n    topP\n    seed\n    stop\n    reasoningEffort\n    extraBody\n  }\n  ... on PromptAnthropicInvocationParameters {\n    anthropicMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n    outputConfig {\n      effort\n    }\n    thinking {\n      __typename\n      ... on PromptAnthropicThinkingDisabled {\n        disabled\n      }\n      ... on PromptAnthropicThinkingEnabled {\n        budgetTokens\n        enabledDisplay: display\n      }\n      ... on PromptAnthropicThinkingAdaptive {\n        adaptiveDisplay: display\n      }\n    }\n    extraBody\n  }\n  ... on PromptGoogleInvocationParameters {\n    temperature\n    maxOutputTokens\n    stopSequences\n    presencePenalty\n    frequencyPenalty\n    topP\n    topK\n    thinkingConfig {\n      thinkingBudget\n      thinkingLevel\n      includeThoughts\n    }\n  }\n  ... on PromptAwsInvocationParameters {\n    awsMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n  }\n}\n\nfragment SpanColumnSelector_annotations on Project {\n  spanAnnotationNames\n}\n\nfragment SpanColumnSelector_traceAnnotations on Project {\n  traceAnnotationsNames\n}\n\nfragment SpansTable_spans on Project {\n  name\n  spanAnnotationNames\n  ...SpanColumnSelector_annotations\n  ...SpanColumnSelector_traceAnnotations\n  spans(first: 30, sort: {col: startTime, dir: desc}, rootSpansOnly: true, orphanSpanAsRootSpan: $orphanSpanAsRootSpan, timeRange: $timeRange) {\n    edges {\n      span: node {\n        id\n        spanKind\n        name\n        metadata\n        statusCode\n        startTime\n        latencyMs\n        cumulativeTokenCountTotal\n        spanId\n        trace {\n          id\n          traceId\n          costSummary {\n            total {\n              cost\n            }\n          }\n          traceAnnotationSummaries {\n            labelFractions {\n              fraction\n              label\n            }\n            count\n            meanScore\n            name\n          }\n          ...TraceAnnotationSummaryGroup\n        }\n        input {\n          value: truncatedValue\n        }\n        output {\n          value: truncatedValue\n        }\n        spanAnnotations {\n          id\n          name\n          label\n          score\n          annotatorKind\n          createdAt\n        }\n        spanAnnotationSummaries {\n          labelFractions {\n            fraction\n            label\n          }\n          meanScore\n          name\n        }\n        documentRetrievalMetrics {\n          evaluationName\n          ndcg\n          precision\n          hit\n        }\n        ...AnnotationSummaryGroup\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment TraceAnnotationSummaryGroup on Trace {\n  project {\n    id\n    annotationConfigs {\n      edges {\n        node {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            id\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n      }\n    }\n  }\n  traceAnnotations {\n    id\n    name\n    label\n    score\n    annotatorKind\n    createdAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n  }\n  traceAnnotationSummaries {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion {\n  id\n  modelName\n  modelProvider\n  invocationParameters {\n    __typename\n    ...PromptInvocationParametersReadableFragment\n  }\n  customProvider {\n    id\n    name\n  }\n  responseFormat {\n    jsonSchema {\n      name\n      description\n      schema\n      strict\n    }\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  tools {\n    tools {\n      __typename\n      ... on PromptToolFunction {\n        function {\n          name\n          description\n          parameters\n          strict\n        }\n      }\n      ... on PromptToolRaw {\n        raw\n      }\n    }\n    toolChoice {\n      type\n      functionName\n    }\n    disableParallelToolCalls\n  }\n}\n"
  }
};
})();

(node as any).hash = "d56f85c90baccd56415780421731cbcf";

export default node;
