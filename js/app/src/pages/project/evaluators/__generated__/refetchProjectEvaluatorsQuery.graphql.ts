/**
 * @generated SignedSource<<dc91eec194773b32b3f61f6556f91f62>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type refetchProjectEvaluatorsQuery$variables = {
  first: number;
  projectId: string;
  timeRange: TimeRange;
};
export type refetchProjectEvaluatorsQuery$data = {
  readonly project: {
    readonly evaluatorCount?: number;
    readonly evaluators?: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_costs" | "ProjectEvaluatorsTable_failures" | "ProjectEvaluatorsTable_lag" | "ProjectEvaluatorsTable_row">;
        };
      }>;
      readonly pageInfo: {
        readonly endCursor: string | null;
        readonly hasNextPage: boolean;
      };
    };
  };
};
export type refetchProjectEvaluatorsQuery = {
  response: refetchProjectEvaluatorsQuery$data;
  variables: refetchProjectEvaluatorsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatorCount",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluationTarget",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "filterCondition",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "samplingRate",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatedCount",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "failedCount",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "concreteType": "ProjectEvaluatorRunSummary",
  "kind": "LinkedField",
  "name": "runSummary",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "status",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastRunAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "queuedCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "runningCount",
      "storageKey": null
    },
    (v12/*:: as any*/),
    (v13/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "droppedCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "oldestQueuedAt",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "concreteType": "ProjectEvaluatorEvaluationLoad",
  "kind": "LinkedField",
  "name": "evaluationLoad",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "meanEvaluationSeconds",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "shareOfEvaluationTime",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v17 = {
  "kind": "InlineFragment",
  "selections": [
    (v6/*:: as any*/),
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
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v19 = {
  "kind": "InlineFragment",
  "selections": [
    (v18/*:: as any*/),
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
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v22 = {
  "kind": "InlineFragment",
  "selections": [
    (v18/*:: as any*/),
    (v20/*:: as any*/),
    (v21/*:: as any*/)
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v23 = {
  "kind": "InlineFragment",
  "selections": [
    (v18/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "threshold",
      "storageKey": null
    },
    (v20/*:: as any*/),
    (v21/*:: as any*/)
  ],
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "concreteType": "Prompt",
  "kind": "LinkedField",
  "name": "prompt",
  "plural": false,
  "selections": [
    (v5/*:: as any*/),
    (v6/*:: as any*/)
  ],
  "storageKey": null
},
v25 = [
  (v6/*:: as any*/)
],
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "decisionId",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "language",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v31 = [
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v32 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v33 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "traceProject",
  "plural": false,
  "selections": [
    (v5/*:: as any*/),
    {
      "alias": null,
      "args": (v31/*:: as any*/),
      "kind": "ScalarField",
      "name": "traceCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v31/*:: as any*/),
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
          "selections": (v32/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "prompt",
          "plural": false,
          "selections": (v32/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "completion",
          "plural": false,
          "selections": (v32/*:: as any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v34 = [
  (v2/*:: as any*/)
],
v35 = {
  "alias": null,
  "args": (v31/*:: as any*/),
  "concreteType": "ProjectEvaluatorFailureSummary",
  "kind": "LinkedField",
  "name": "failureSummary",
  "plural": false,
  "selections": [
    (v13/*:: as any*/),
    (v12/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "failureRate",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastFailedAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastError",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v36 = {
  "alias": null,
  "args": (v31/*:: as any*/),
  "concreteType": "EvaluationLag",
  "kind": "LinkedField",
  "name": "lag",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "p50Seconds",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "p95Seconds",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "p99Seconds",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v37 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v38 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v39 = {
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
},
v40 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  }
],
v41 = [
  (v6/*:: as any*/),
  (v5/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "refetchProjectEvaluatorsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              {
                "alias": "evaluators",
                "args": null,
                "concreteType": "ProjectEvaluatorConnection",
                "kind": "LinkedField",
                "name": "__ProjectEvaluatorsTable_evaluators_connection",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ProjectEvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ProjectEvaluator",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          {
                            "kind": "InlineDataFragmentSpread",
                            "name": "ProjectEvaluatorsTable_row",
                            "selections": [
                              (v5/*:: as any*/),
                              (v6/*:: as any*/),
                              (v7/*:: as any*/),
                              (v8/*:: as any*/),
                              (v9/*:: as any*/),
                              (v10/*:: as any*/),
                              (v11/*:: as any*/),
                              (v14/*:: as any*/),
                              (v15/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "evaluator",
                                "plural": false,
                                "selections": [
                                  (v5/*:: as any*/),
                                  (v16/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "outputConfigs",
                                    "plural": true,
                                    "selections": [
                                      (v17/*:: as any*/),
                                      (v19/*:: as any*/),
                                      (v22/*:: as any*/),
                                      (v23/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v24/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "PromptVersionTag",
                                        "kind": "LinkedField",
                                        "name": "promptVersionTag",
                                        "plural": false,
                                        "selections": (v25/*:: as any*/),
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
                                          (v26/*:: as any*/),
                                          (v27/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "LLMEvaluator",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "DecisionVersion",
                                        "kind": "LinkedField",
                                        "name": "decisionVersion",
                                        "plural": false,
                                        "selections": [
                                          (v5/*:: as any*/),
                                          (v28/*:: as any*/),
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": "Decision",
                                            "kind": "LinkedField",
                                            "name": "decision",
                                            "plural": false,
                                            "selections": (v25/*:: as any*/),
                                            "storageKey": null
                                          },
                                          (v26/*:: as any*/),
                                          (v27/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "DecisionEvaluator",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v29/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "SandboxConfig",
                                        "kind": "LinkedField",
                                        "name": "sandboxConfig",
                                        "plural": false,
                                        "selections": [
                                          (v5/*:: as any*/),
                                          (v6/*:: as any*/),
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": "SandboxProvider",
                                            "kind": "LinkedField",
                                            "name": "provider",
                                            "plural": false,
                                            "selections": [
                                              (v30/*:: as any*/)
                                            ],
                                            "storageKey": null
                                          }
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "CodeEvaluator",
                                    "abstractKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "args": null,
                            "argumentDefinitions": []
                          },
                          {
                            "kind": "InlineDataFragmentSpread",
                            "name": "ProjectEvaluatorsTable_costs",
                            "selections": [
                              (v33/*:: as any*/)
                            ],
                            "args": (v31/*:: as any*/),
                            "argumentDefinitions": (v34/*:: as any*/)
                          },
                          {
                            "kind": "InlineDataFragmentSpread",
                            "name": "ProjectEvaluatorsTable_failures",
                            "selections": [
                              (v35/*:: as any*/)
                            ],
                            "args": (v31/*:: as any*/),
                            "argumentDefinitions": (v34/*:: as any*/)
                          },
                          {
                            "kind": "InlineDataFragmentSpread",
                            "name": "ProjectEvaluatorsTable_lag",
                            "selections": [
                              (v36/*:: as any*/)
                            ],
                            "args": (v31/*:: as any*/),
                            "argumentDefinitions": (v34/*:: as any*/)
                          },
                          (v37/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      (v38/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v39/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
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
      (v1/*:: as any*/),
      (v0/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "refetchProjectEvaluatorsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v37/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": (v40/*:: as any*/),
                "concreteType": "ProjectEvaluatorConnection",
                "kind": "LinkedField",
                "name": "evaluators",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ProjectEvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ProjectEvaluator",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v5/*:: as any*/),
                          (v6/*:: as any*/),
                          (v7/*:: as any*/),
                          (v8/*:: as any*/),
                          (v9/*:: as any*/),
                          (v10/*:: as any*/),
                          (v11/*:: as any*/),
                          (v14/*:: as any*/),
                          (v15/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "evaluator",
                            "plural": false,
                            "selections": [
                              (v37/*:: as any*/),
                              (v5/*:: as any*/),
                              (v16/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "outputConfigs",
                                "plural": true,
                                "selections": [
                                  (v37/*:: as any*/),
                                  (v17/*:: as any*/),
                                  (v19/*:: as any*/),
                                  (v22/*:: as any*/),
                                  (v23/*:: as any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v5/*:: as any*/)
                                    ],
                                    "type": "Node",
                                    "abstractKey": "__isNode"
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v24/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "PromptVersionTag",
                                    "kind": "LinkedField",
                                    "name": "promptVersionTag",
                                    "plural": false,
                                    "selections": (v41/*:: as any*/),
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
                                      (v26/*:: as any*/),
                                      (v27/*:: as any*/),
                                      (v5/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "LLMEvaluator",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "DecisionVersion",
                                    "kind": "LinkedField",
                                    "name": "decisionVersion",
                                    "plural": false,
                                    "selections": [
                                      (v5/*:: as any*/),
                                      (v28/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "Decision",
                                        "kind": "LinkedField",
                                        "name": "decision",
                                        "plural": false,
                                        "selections": (v41/*:: as any*/),
                                        "storageKey": null
                                      },
                                      (v26/*:: as any*/),
                                      (v27/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "DecisionEvaluator",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v29/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "SandboxConfig",
                                    "kind": "LinkedField",
                                    "name": "sandboxConfig",
                                    "plural": false,
                                    "selections": [
                                      (v5/*:: as any*/),
                                      (v6/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "SandboxProvider",
                                        "kind": "LinkedField",
                                        "name": "provider",
                                        "plural": false,
                                        "selections": [
                                          (v30/*:: as any*/),
                                          (v5/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "CodeEvaluator",
                                "abstractKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v33/*:: as any*/),
                          (v35/*:: as any*/),
                          (v36/*:: as any*/),
                          (v37/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      (v38/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v39/*:: as any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v40/*:: as any*/),
                "filters": null,
                "handle": "connection",
                "key": "ProjectEvaluatorsTable_evaluators",
                "kind": "LinkedHandle",
                "name": "evaluators"
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
          (v5/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "327cf276cecc8e3f3335f921ece51587",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": "first",
          "cursor": null,
          "direction": "forward",
          "path": [
            "project",
            "evaluators"
          ]
        }
      ]
    },
    "name": "refetchProjectEvaluatorsQuery",
    "operationKind": "query",
    "text": "query refetchProjectEvaluatorsQuery(\n  $projectId: ID!\n  $first: Int!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluatorCount\n      evaluators(first: $first) {\n        edges {\n          node {\n            ...ProjectEvaluatorsTable_row\n            ...ProjectEvaluatorsTable_costs_3E0ZE6\n            ...ProjectEvaluatorsTable_failures_3E0ZE6\n            ...ProjectEvaluatorsTable_lag_3E0ZE6\n            id\n            __typename\n          }\n          cursor\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ProjectEvaluatorsTable_costs_3E0ZE6 on ProjectEvaluator {\n  traceProject {\n    id\n    traceCount(timeRange: $timeRange)\n    costSummary(timeRange: $timeRange) {\n      total {\n        cost\n      }\n      prompt {\n        cost\n      }\n      completion {\n        cost\n      }\n    }\n  }\n}\n\nfragment ProjectEvaluatorsTable_failures_3E0ZE6 on ProjectEvaluator {\n  failureSummary(timeRange: $timeRange) {\n    failedCount\n    evaluatedCount\n    failureRate\n    lastFailedAt\n    lastError\n  }\n}\n\nfragment ProjectEvaluatorsTable_lag_3E0ZE6 on ProjectEvaluator {\n  lag(timeRange: $timeRange) {\n    p50Seconds\n    p95Seconds\n    p99Seconds\n  }\n}\n\nfragment ProjectEvaluatorsTable_row on ProjectEvaluator {\n  id\n  name\n  evaluationTarget\n  filterCondition\n  samplingRate\n  enabled\n  updatedAt\n  runSummary {\n    status\n    lastRunAt\n    queuedCount\n    runningCount\n    evaluatedCount\n    failedCount\n    droppedCount\n    oldestQueuedAt\n  }\n  evaluationLoad {\n    evaluationCount\n    meanEvaluationSeconds\n    shareOfEvaluationTime\n  }\n  evaluator {\n    __typename\n    id\n    kind\n    outputConfigs {\n      __typename\n      ... on AnnotationConfigBase {\n        __isAnnotationConfigBase: __typename\n        name\n        annotationType\n      }\n      ... on CategoricalAnnotationConfig {\n        optimizationDirection\n        values {\n          label\n          score\n        }\n      }\n      ... on ContinuousAnnotationConfig {\n        optimizationDirection\n        lowerBound\n        upperBound\n      }\n      ... on FreeformAnnotationConfig {\n        optimizationDirection\n        threshold\n        lowerBound\n        upperBound\n      }\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        id\n      }\n    }\n    ... on DecisionEvaluator {\n      decisionVersion {\n        id\n        decisionId\n        decision {\n          name\n          id\n        }\n        modelName\n        modelProvider\n      }\n    }\n    ... on CodeEvaluator {\n      language\n      sandboxConfig {\n        id\n        name\n        provider {\n          backendType\n          id\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e51b91a6d2612ec75ac04179a93e24e6";

export default node;
