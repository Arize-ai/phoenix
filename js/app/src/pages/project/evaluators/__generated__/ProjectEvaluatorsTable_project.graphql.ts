/**
 * @generated SignedSource<<6fe5749ba807f335b128c2ba0160b9ef>>
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
        readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_costs" | "ProjectEvaluatorsTable_row" | "ProjectEvaluatorsTable_scores">;
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
  "name": "includeMeanScore"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "scorePreviousTimeRange"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "scoreTimeBinConfig"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "scoreTimeRange"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v5 = [
  "evaluators"
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
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
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "meanScore",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
};
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
    (v0/*:: as any*/),
    (v1/*:: as any*/),
    (v2/*:: as any*/),
    (v3/*:: as any*/),
    (v4/*:: as any*/)
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v5/*:: as any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v5/*:: as any*/)
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
                    (v6/*:: as any*/),
                    (v7/*:: as any*/),
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
                      "name": "schedulabilityStatus",
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
                      "kind": "ScalarField",
                      "name": "schedulabilityReason",
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
                          "name": "evaluatedCount",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "failedCount",
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
                                (v7/*:: as any*/),
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
                                (v8/*:: as any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": "CategoricalAnnotationValue",
                                  "kind": "LinkedField",
                                  "name": "values",
                                  "plural": true,
                                  "selections": [
                                    (v9/*:: as any*/),
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
                                (v8/*:: as any*/),
                                (v10/*:: as any*/),
                                (v11/*:: as any*/)
                              ],
                              "type": "ContinuousAnnotationConfig",
                              "abstractKey": null
                            },
                            {
                              "kind": "InlineFragment",
                              "selections": [
                                (v8/*:: as any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "threshold",
                                  "storageKey": null
                                },
                                (v10/*:: as any*/),
                                (v11/*:: as any*/)
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
                                (v6/*:: as any*/),
                                (v7/*:: as any*/)
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
                                (v7/*:: as any*/)
                              ],
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
                                }
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
                                (v6/*:: as any*/),
                                (v7/*:: as any*/),
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
                        (v6/*:: as any*/),
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
                  "argumentDefinitions": [
                    (v4/*:: as any*/)
                  ]
                },
                {
                  "kind": "InlineDataFragmentSpread",
                  "name": "ProjectEvaluatorsTable_scores",
                  "selections": [
                    {
                      "condition": "includeMeanScore",
                      "kind": "Condition",
                      "passingValue": true,
                      "selections": [
                        {
                          "alias": null,
                          "args": [
                            {
                              "kind": "Variable",
                              "name": "previousTimeRange",
                              "variableName": "scorePreviousTimeRange"
                            },
                            {
                              "kind": "Variable",
                              "name": "timeBinConfig",
                              "variableName": "scoreTimeBinConfig"
                            },
                            {
                              "kind": "Variable",
                              "name": "timeRange",
                              "variableName": "scoreTimeRange"
                            }
                          ],
                          "concreteType": "EvaluatorAnnotationScoreMetrics",
                          "kind": "LinkedField",
                          "name": "annotationScoreMetrics",
                          "plural": true,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "annotationName",
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "AnnotationSummary",
                              "kind": "LinkedField",
                              "name": "summary",
                              "plural": false,
                              "selections": [
                                (v14/*:: as any*/),
                                (v15/*:: as any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "scoreCount",
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "labelCount",
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": "LabelFraction",
                                  "kind": "LinkedField",
                                  "name": "labelFractions",
                                  "plural": true,
                                  "selections": [
                                    (v9/*:: as any*/),
                                    {
                                      "alias": null,
                                      "args": null,
                                      "kind": "ScalarField",
                                      "name": "fraction",
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
                              "name": "previousSummary",
                              "plural": false,
                              "selections": [
                                (v14/*:: as any*/)
                              ],
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "EvaluatorScoreSeriesBin",
                              "kind": "LinkedField",
                              "name": "series",
                              "plural": true,
                              "selections": [
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "timestamp",
                                  "storageKey": null
                                },
                                (v14/*:: as any*/),
                                (v15/*:: as any*/)
                              ],
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        }
                      ]
                    }
                  ],
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
                  "argumentDefinitions": [
                    (v0/*:: as any*/),
                    (v1/*:: as any*/),
                    (v2/*:: as any*/),
                    (v3/*:: as any*/)
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
    (v6/*:: as any*/)
  ],
  "type": "Project",
  "abstractKey": null
};
})();

(node as any).hash = "927402af67eed497b895297f1a6b88c1";

export default node;
