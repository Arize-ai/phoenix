/**
 * @generated SignedSource<<438b8a819541c2a23df54df3fee1e853>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorsTable_project$data = {
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorMeanScoreCell_scores" | "ProjectEvaluatorsTable_costs" | "ProjectEvaluatorsTable_failures" | "ProjectEvaluatorsTable_lag" | "ProjectEvaluatorsTable_row">;
      };
    }>;
  };
  readonly id: string;
  readonly " $fragmentType": "ProjectEvaluatorsTable_project";
};
export type ProjectEvaluatorsTable_project$key = {
  readonly " $data"?: ProjectEvaluatorsTable_project$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_project">;
};

import ProjectEvaluatorsTablePaginationQuery_graphql from './ProjectEvaluatorsTablePaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v1 = [
  "evaluators"
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
  "name": "evaluatedCount",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "failedCount",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v9 = [
  (v3/*:: as any*/)
],
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v12 = [
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v13 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v14 = [
  (v0/*:: as any*/)
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "filter"
    },
    {
      "defaultValue": 30,
      "kind": "LocalArgument",
      "name": "first"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "includeMeanScore"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "scorePreviousTimeRange"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "scoreTimeBinConfig"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "scoreTimeRange"
    },
    (v0/*:: as any*/)
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v1/*:: as any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v1/*:: as any*/)
      },
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ProjectEvaluatorsTablePaginationQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ProjectEvaluatorsTable_project",
  "selections": [
    {
      "alias": "evaluators",
      "args": [
        {
          "kind": "Variable",
          "name": "filter",
          "variableName": "filter"
        }
      ],
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
                    (v2/*:: as any*/),
                    (v3/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "evaluationTarget",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "filterCondition",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "samplingRate",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "enabled",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "updatedAt",
                      "storageKey": null
                    },
                    {
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
                        (v4/*:: as any*/),
                        (v5/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "clearedCount",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "oldestWaitingOrRetryingAt",
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "tracingEnabled",
                      "storageKey": null
                    },
                    {
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
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "excludesUntracedEvaluators",
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
                      "name": "evaluator",
                      "plural": false,
                      "selections": [
                        (v2/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "kind",
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
                            {
                              "kind": "InlineFragment",
                              "selections": [
                                (v3/*:: as any*/),
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
                                (v6/*:: as any*/),
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
                            {
                              "kind": "InlineFragment",
                              "selections": [
                                (v6/*:: as any*/),
                                (v7/*:: as any*/),
                                (v8/*:: as any*/)
                              ],
                              "type": "ContinuousAnnotationConfig",
                              "abstractKey": null
                            },
                            {
                              "kind": "InlineFragment",
                              "selections": [
                                (v6/*:: as any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "threshold",
                                  "storageKey": null
                                },
                                (v7/*:: as any*/),
                                (v8/*:: as any*/)
                              ],
                              "type": "FreeformAnnotationConfig",
                              "abstractKey": null
                            }
                          ],
                          "storageKey": null
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
                              "selections": [
                                (v2/*:: as any*/),
                                (v3/*:: as any*/)
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
                              "selections": (v9/*:: as any*/),
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
                                (v10/*:: as any*/),
                                (v11/*:: as any*/)
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
                              "concreteType": "DecisionVersionTag",
                              "kind": "LinkedField",
                              "name": "decisionVersionTag",
                              "plural": false,
                              "selections": (v9/*:: as any*/),
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "DecisionVersion",
                              "kind": "LinkedField",
                              "name": "decisionVersion",
                              "plural": false,
                              "selections": [
                                (v2/*:: as any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "decisionId",
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": "Decision",
                                  "kind": "LinkedField",
                                  "name": "decision",
                                  "plural": false,
                                  "selections": (v9/*:: as any*/),
                                  "storageKey": null
                                },
                                (v10/*:: as any*/),
                                (v11/*:: as any*/)
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
                              "concreteType": "SandboxConfig",
                              "kind": "LinkedField",
                              "name": "sandboxConfig",
                              "plural": false,
                              "selections": [
                                (v2/*:: as any*/),
                                (v3/*:: as any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": "SandboxProvider",
                                  "kind": "LinkedField",
                                  "name": "provider",
                                  "plural": false,
                                  "selections": [
                                    {
                                      "alias": null,
                                      "args": null,
                                      "kind": "ScalarField",
                                      "name": "backendType",
                                      "storageKey": null
                                    }
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
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "Project",
                      "kind": "LinkedField",
                      "name": "traceProject",
                      "plural": false,
                      "selections": [
                        (v2/*:: as any*/),
                        {
                          "alias": null,
                          "args": (v12/*:: as any*/),
                          "kind": "ScalarField",
                          "name": "traceCount",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": (v12/*:: as any*/),
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
                              "selections": (v13/*:: as any*/),
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "CostBreakdown",
                              "kind": "LinkedField",
                              "name": "prompt",
                              "plural": false,
                              "selections": (v13/*:: as any*/),
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "CostBreakdown",
                              "kind": "LinkedField",
                              "name": "completion",
                              "plural": false,
                              "selections": (v13/*:: as any*/),
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "args": (v12/*:: as any*/),
                  "argumentDefinitions": (v14/*:: as any*/)
                },
                {
                  "kind": "InlineDataFragmentSpread",
                  "name": "ProjectEvaluatorsTable_failures",
                  "selections": [
                    {
                      "alias": null,
                      "args": (v12/*:: as any*/),
                      "concreteType": "ProjectEvaluatorFailureSummary",
                      "kind": "LinkedField",
                      "name": "failureSummary",
                      "plural": false,
                      "selections": [
                        (v5/*:: as any*/),
                        (v4/*:: as any*/),
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
                    }
                  ],
                  "args": (v12/*:: as any*/),
                  "argumentDefinitions": (v14/*:: as any*/)
                },
                {
                  "kind": "InlineDataFragmentSpread",
                  "name": "ProjectEvaluatorsTable_lag",
                  "selections": [
                    {
                      "alias": null,
                      "args": (v12/*:: as any*/),
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
                    }
                  ],
                  "args": (v12/*:: as any*/),
                  "argumentDefinitions": (v14/*:: as any*/)
                },
                {
                  "kind": "Defer",
                  "selections": [
                    {
                      "args": [
                        {
                          "kind": "Variable",
                          "name": "includeMeanScore",
                          "variableName": "includeMeanScore"
                        },
                        {
                          "kind": "Variable",
                          "name": "scorePreviousTimeRange",
                          "variableName": "scorePreviousTimeRange"
                        },
                        {
                          "kind": "Variable",
                          "name": "scoreTimeBinConfig",
                          "variableName": "scoreTimeBinConfig"
                        },
                        {
                          "kind": "Variable",
                          "name": "scoreTimeRange",
                          "variableName": "scoreTimeRange"
                        }
                      ],
                      "kind": "FragmentSpread",
                      "name": "ProjectEvaluatorMeanScoreCell_scores"
                    }
                  ]
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
                  "storageKey": null
                }
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
    (v2/*:: as any*/)
  ],
  "type": "Project",
  "abstractKey": null
};
})();

(node as any).hash = "43527f8116f1c0150a7c7b20a2813a7f";

export default node;
