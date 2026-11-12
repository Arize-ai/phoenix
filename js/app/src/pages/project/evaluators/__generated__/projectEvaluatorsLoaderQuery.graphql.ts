/**
 * @generated SignedSource<<0cc52c39293df106eda664110a6536a0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorFilterColumn = "name";
export type TimeBinScale = "DAY" | "HOUR" | "MINUTE" | "MONTH" | "WEEK" | "YEAR";
export type ProjectEvaluatorFilter = {
  annotationNames?: ReadonlyArray<string> | null;
  col?: ProjectEvaluatorFilterColumn | null;
  value?: string | null;
};
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type TimeBinConfig = {
  scale?: TimeBinScale;
  unitsPerBin?: number;
  utcOffsetMinutes?: number;
};
export type projectEvaluatorsLoaderQuery$variables = {
  filter?: ProjectEvaluatorFilter | null;
  includeMeanScore: boolean;
  projectId: string;
  scorePreviousTimeRange: TimeRange;
  scoreTimeBinConfig: TimeBinConfig;
  scoreTimeRange: TimeRange;
  timeRange: TimeRange;
};
export type projectEvaluatorsLoaderQuery$data = {
  readonly project: {
    readonly evaluatorCount?: number;
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_project">;
  };
};
export type projectEvaluatorsLoaderQuery = {
  response: projectEvaluatorsLoaderQuery$data;
  variables: projectEvaluatorsLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filter"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "includeMeanScore"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "scorePreviousTimeRange"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "scoreTimeBinConfig"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "scoreTimeRange"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v7 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatorCount",
  "storageKey": null
},
v9 = {
  "kind": "Variable",
  "name": "filter",
  "variableName": "filter"
},
v10 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v13 = [
  (v9/*:: as any*/),
  {
    "kind": "Literal",
    "name": "first",
    "value": 30
  }
],
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatedCount",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "failedCount",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v21 = [
  (v14/*:: as any*/),
  (v12/*:: as any*/)
],
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v24 = [
  (v10/*:: as any*/)
],
v25 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "meanScore",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "count",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "concreteType": "LabelFraction",
  "kind": "LinkedField",
  "name": "labelFractions",
  "plural": true,
  "selections": [
    (v18/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "fraction",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/),
      (v4/*:: as any*/),
      (v5/*:: as any*/),
      (v6/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "projectEvaluatorsLoaderQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v7/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v8/*:: as any*/),
              {
                "args": [
                  (v9/*:: as any*/),
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
                  },
                  (v10/*:: as any*/)
                ],
                "kind": "FragmentSpread",
                "name": "ProjectEvaluatorsTable_project"
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
      (v2/*:: as any*/),
      (v0/*:: as any*/),
      (v6/*:: as any*/),
      (v5/*:: as any*/),
      (v3/*:: as any*/),
      (v4/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "projectEvaluatorsLoaderQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v7/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v11/*:: as any*/),
          (v12/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v8/*:: as any*/),
              {
                "alias": null,
                "args": (v13/*:: as any*/),
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
                          (v12/*:: as any*/),
                          (v14/*:: as any*/),
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
                              (v15/*:: as any*/),
                              (v16/*:: as any*/),
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
                              (v11/*:: as any*/),
                              (v12/*:: as any*/),
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
                                  (v11/*:: as any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v14/*:: as any*/),
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
                                      (v17/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "CategoricalAnnotationValue",
                                        "kind": "LinkedField",
                                        "name": "values",
                                        "plural": true,
                                        "selections": [
                                          (v18/*:: as any*/),
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
                                      (v17/*:: as any*/),
                                      (v19/*:: as any*/),
                                      (v20/*:: as any*/)
                                    ],
                                    "type": "ContinuousAnnotationConfig",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v17/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "threshold",
                                        "storageKey": null
                                      },
                                      (v19/*:: as any*/),
                                      (v20/*:: as any*/)
                                    ],
                                    "type": "FreeformAnnotationConfig",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v12/*:: as any*/)
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
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "Prompt",
                                    "kind": "LinkedField",
                                    "name": "prompt",
                                    "plural": false,
                                    "selections": [
                                      (v12/*:: as any*/),
                                      (v14/*:: as any*/)
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
                                    "selections": (v21/*:: as any*/),
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
                                      (v22/*:: as any*/),
                                      (v23/*:: as any*/),
                                      (v12/*:: as any*/)
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
                                    "selections": (v21/*:: as any*/),
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
                                      (v12/*:: as any*/),
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
                                        "selections": (v21/*:: as any*/),
                                        "storageKey": null
                                      },
                                      (v22/*:: as any*/),
                                      (v23/*:: as any*/)
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
                                      (v12/*:: as any*/),
                                      (v14/*:: as any*/),
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
                                          },
                                          (v12/*:: as any*/)
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
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Project",
                            "kind": "LinkedField",
                            "name": "traceProject",
                            "plural": false,
                            "selections": [
                              (v12/*:: as any*/),
                              {
                                "alias": null,
                                "args": (v24/*:: as any*/),
                                "kind": "ScalarField",
                                "name": "traceCount",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": (v24/*:: as any*/),
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
                                    "selections": (v25/*:: as any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CostBreakdown",
                                    "kind": "LinkedField",
                                    "name": "prompt",
                                    "plural": false,
                                    "selections": (v25/*:: as any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CostBreakdown",
                                    "kind": "LinkedField",
                                    "name": "completion",
                                    "plural": false,
                                    "selections": (v25/*:: as any*/),
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
                            "args": (v24/*:: as any*/),
                            "concreteType": "ProjectEvaluatorFailureSummary",
                            "kind": "LinkedField",
                            "name": "failureSummary",
                            "plural": false,
                            "selections": [
                              (v16/*:: as any*/),
                              (v15/*:: as any*/),
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
                          {
                            "alias": null,
                            "args": (v24/*:: as any*/),
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
                          {
                            "if": null,
                            "kind": "Defer",
                            "label": "ProjectEvaluatorsTable_project$defer$ProjectEvaluatorMeanScoreCell_scores_1qAmj3",
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
                                          (v26/*:: as any*/),
                                          (v27/*:: as any*/),
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
                                          (v28/*:: as any*/)
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
                                          (v26/*:: as any*/),
                                          (v28/*:: as any*/)
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
                                          (v26/*:: as any*/),
                                          (v27/*:: as any*/),
                                          (v28/*:: as any*/),
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "resultCount",
                                            "storageKey": null
                                          }
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  }
                                ]
                              }
                            ]
                          },
                          (v11/*:: as any*/)
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
              {
                "alias": null,
                "args": (v13/*:: as any*/),
                "filters": [
                  "filter"
                ],
                "handle": "connection",
                "key": "ProjectEvaluatorsTable_evaluators",
                "kind": "LinkedHandle",
                "name": "evaluators"
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "64bff6d6dd5fcff806663dced79e45be",
    "id": null,
    "metadata": {},
    "name": "projectEvaluatorsLoaderQuery",
    "operationKind": "query",
    "text": "query projectEvaluatorsLoaderQuery(\n  $projectId: ID!\n  $filter: ProjectEvaluatorFilter\n  $timeRange: TimeRange!\n  $scoreTimeRange: TimeRange!\n  $scorePreviousTimeRange: TimeRange!\n  $scoreTimeBinConfig: TimeBinConfig!\n  $includeMeanScore: Boolean!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluatorCount\n      ...ProjectEvaluatorsTable_project_13VVNU\n    }\n    id\n  }\n}\n\nfragment ProjectEvaluatorMeanScoreCell_scores_1qAmj3 on ProjectEvaluator {\n  annotationScoreMetrics(timeRange: $scoreTimeRange, previousTimeRange: $scorePreviousTimeRange, timeBinConfig: $scoreTimeBinConfig) @include(if: $includeMeanScore) {\n    annotationName\n    summary {\n      meanScore\n      count\n      scoreCount\n      labelCount\n      labelFractions {\n        label\n        fraction\n      }\n    }\n    previousSummary {\n      meanScore\n      labelFractions {\n        label\n        fraction\n      }\n    }\n    series {\n      timestamp\n      meanScore\n      count\n      labelFractions {\n        label\n        fraction\n      }\n      resultCount\n    }\n  }\n}\n\nfragment ProjectEvaluatorsTable_costs_3E0ZE6 on ProjectEvaluator {\n  traceProject {\n    id\n    traceCount(timeRange: $timeRange)\n    costSummary(timeRange: $timeRange) {\n      total {\n        cost\n      }\n      prompt {\n        cost\n      }\n      completion {\n        cost\n      }\n    }\n  }\n}\n\nfragment ProjectEvaluatorsTable_failures_3E0ZE6 on ProjectEvaluator {\n  failureSummary(timeRange: $timeRange) {\n    failedCount\n    evaluatedCount\n    failureRate\n    lastFailedAt\n    lastError\n  }\n}\n\nfragment ProjectEvaluatorsTable_lag_3E0ZE6 on ProjectEvaluator {\n  lag(timeRange: $timeRange) {\n    p50Seconds\n    p95Seconds\n    p99Seconds\n  }\n}\n\nfragment ProjectEvaluatorsTable_project_13VVNU on Project {\n  evaluators(first: 30, filter: $filter) {\n    edges {\n      node {\n        ...ProjectEvaluatorsTable_row\n        ...ProjectEvaluatorsTable_costs_3E0ZE6\n        ...ProjectEvaluatorsTable_failures_3E0ZE6\n        ...ProjectEvaluatorsTable_lag_3E0ZE6\n        ...ProjectEvaluatorMeanScoreCell_scores_1qAmj3 @defer(label: \"ProjectEvaluatorsTable_project$defer$ProjectEvaluatorMeanScoreCell_scores_1qAmj3\")\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment ProjectEvaluatorsTable_row on ProjectEvaluator {\n  id\n  name\n  evaluationTarget\n  filterCondition\n  samplingRate\n  enabled\n  updatedAt\n  runSummary {\n    status\n    lastRunAt\n    queuedCount\n    runningCount\n    evaluatedCount\n    failedCount\n    clearedCount\n    oldestWaitingOrRetryingAt\n  }\n  tracingEnabled\n  evaluationLoad {\n    evaluationCount\n    meanEvaluationSeconds\n    shareOfEvaluationTime\n    excludesUntracedEvaluators\n  }\n  evaluator {\n    __typename\n    id\n    kind\n    outputConfigs {\n      __typename\n      ... on AnnotationConfigBase {\n        __isAnnotationConfigBase: __typename\n        name\n        annotationType\n      }\n      ... on CategoricalAnnotationConfig {\n        optimizationDirection\n        values {\n          label\n          score\n        }\n      }\n      ... on ContinuousAnnotationConfig {\n        optimizationDirection\n        lowerBound\n        upperBound\n      }\n      ... on FreeformAnnotationConfig {\n        optimizationDirection\n        threshold\n        lowerBound\n        upperBound\n      }\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        id\n      }\n    }\n    ... on DecisionEvaluator {\n      decisionVersionTag {\n        name\n        id\n      }\n      decisionVersion {\n        id\n        decisionId\n        decision {\n          name\n          id\n        }\n        modelName\n        modelProvider\n      }\n    }\n    ... on CodeEvaluator {\n      language\n      sandboxConfig {\n        id\n        name\n        provider {\n          backendType\n          id\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f508212a756e44775bfde9b353b4b50b";

export default node;
