/**
 * @generated SignedSource<<2459cddfc6732b0c97180a5acab8cd82>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentComparePageQueriesCompareGridQuery$variables = {
  baseExperimentId: string;
  compareExperimentIds: ReadonlyArray<string>;
  datasetId: string;
  experimentIds: ReadonlyArray<string>;
};
export type ExperimentComparePageQueriesCompareGridQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareTable_comparisons">;
};
export type ExperimentComparePageQueriesCompareGridQuery = {
  response: ExperimentComparePageQueriesCompareGridQuery$data;
  variables: ExperimentComparePageQueriesCompareGridQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "baseExperimentId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "compareExperimentIds"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "experimentIds"
},
v4 = {
  "kind": "Variable",
  "name": "baseExperimentId",
  "variableName": "baseExperimentId"
},
v5 = {
  "kind": "Variable",
  "name": "compareExperimentIds",
  "variableName": "compareExperimentIds"
},
v6 = [
  (v4/*:: as any*/),
  (v5/*:: as any*/),
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokens",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v10 = {
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
        (v8/*:: as any*/),
        (v9/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v11 = [
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
    "kind": "ScalarField",
    "name": "meanScore",
    "storageKey": null
  }
],
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "Trace",
  "kind": "LinkedField",
  "name": "trace",
  "plural": false,
  "selections": [
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
      "kind": "ScalarField",
      "name": "projectId",
      "storageKey": null
    },
    (v7/*:: as any*/)
  ],
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "probability",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "confidence",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v22 = [
  (v7/*:: as any*/)
],
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentComparePageQueriesCompareGridQuery",
    "selections": [
      {
        "args": [
          (v4/*:: as any*/),
          (v5/*:: as any*/),
          {
            "kind": "Variable",
            "name": "datasetId",
            "variableName": "datasetId"
          },
          {
            "kind": "Variable",
            "name": "experimentIds",
            "variableName": "experimentIds"
          }
        ],
        "kind": "FragmentSpread",
        "name": "ExperimentCompareTable_comparisons"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*:: as any*/),
      (v3/*:: as any*/),
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ExperimentComparePageQueriesCompareGridQuery",
    "selections": [
      {
        "alias": null,
        "args": (v6/*:: as any*/),
        "concreteType": "ExperimentComparisonConnection",
        "kind": "LinkedField",
        "name": "compareExperiments",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ExperimentComparisonEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": "comparison",
                "args": null,
                "concreteType": "ExperimentComparison",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetExample",
                    "kind": "LinkedField",
                    "name": "example",
                    "plural": false,
                    "selections": [
                      (v7/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "externalId",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DatasetExampleRevision",
                        "kind": "LinkedField",
                        "name": "revision",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "input",
                            "storageKey": null
                          },
                          {
                            "alias": "referenceOutput",
                            "args": null,
                            "kind": "ScalarField",
                            "name": "output",
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
                    "concreteType": "ExperimentRepeatedRunGroup",
                    "kind": "LinkedField",
                    "name": "repeatedRunGroups",
                    "plural": true,
                    "selections": [
                      (v7/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "averageLatencyMs",
                        "storageKey": null
                      },
                      (v10/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExperimentRepeatedRunGroupAnnotationSummary",
                        "kind": "LinkedField",
                        "name": "annotationSummaries",
                        "plural": true,
                        "selections": (v11/*:: as any*/),
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "experimentId",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExperimentRun",
                        "kind": "LinkedField",
                        "name": "runs",
                        "plural": true,
                        "selections": [
                          (v7/*:: as any*/),
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
                            "name": "repetitionNumber",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "output",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "error",
                            "storageKey": null
                          },
                          (v12/*:: as any*/),
                          (v10/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentRunAnnotationConnection",
                            "kind": "LinkedField",
                            "name": "annotations",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "ExperimentRunAnnotationEdge",
                                "kind": "LinkedField",
                                "name": "edges",
                                "plural": true,
                                "selections": [
                                  {
                                    "alias": "annotation",
                                    "args": null,
                                    "concreteType": "ExperimentRunAnnotation",
                                    "kind": "LinkedField",
                                    "name": "node",
                                    "plural": false,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "DecisionAnnotation",
                                        "kind": "LinkedField",
                                        "name": "decision",
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
                                            "concreteType": "DecisionAnnotationQuestion",
                                            "kind": "LinkedField",
                                            "name": "question",
                                            "plural": false,
                                            "selections": [
                                              (v13/*:: as any*/),
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
                                                "concreteType": "DecisionChoiceOption",
                                                "kind": "LinkedField",
                                                "name": "choices",
                                                "plural": true,
                                                "selections": [
                                                  (v14/*:: as any*/),
                                                  (v15/*:: as any*/)
                                                ],
                                                "storageKey": null
                                              },
                                              {
                                                "alias": null,
                                                "args": null,
                                                "concreteType": "DecisionScaleLevel",
                                                "kind": "LinkedField",
                                                "name": "levels",
                                                "plural": true,
                                                "selections": [
                                                  (v16/*:: as any*/),
                                                  (v15/*:: as any*/)
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
                                            "name": "answer",
                                            "plural": false,
                                            "selections": [
                                              (v17/*:: as any*/),
                                              {
                                                "kind": "InlineFragment",
                                                "selections": [
                                                  (v18/*:: as any*/)
                                                ],
                                                "type": "PredicateAnswer",
                                                "abstractKey": null
                                              },
                                              {
                                                "kind": "InlineFragment",
                                                "selections": [
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "kind": "ScalarField",
                                                    "name": "choice",
                                                    "storageKey": null
                                                  },
                                                  (v19/*:: as any*/),
                                                  {
                                                    "alias": "choiceProbabilities",
                                                    "args": null,
                                                    "concreteType": "ChoiceProbability",
                                                    "kind": "LinkedField",
                                                    "name": "probabilities",
                                                    "plural": true,
                                                    "selections": [
                                                      (v14/*:: as any*/),
                                                      (v18/*:: as any*/)
                                                    ],
                                                    "storageKey": null
                                                  }
                                                ],
                                                "type": "ChoiceAnswer",
                                                "abstractKey": null
                                              },
                                              {
                                                "kind": "InlineFragment",
                                                "selections": [
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "kind": "ScalarField",
                                                    "name": "expectedLevel",
                                                    "storageKey": null
                                                  },
                                                  (v19/*:: as any*/),
                                                  {
                                                    "alias": "levelProbabilities",
                                                    "args": null,
                                                    "concreteType": "LevelProbability",
                                                    "kind": "LinkedField",
                                                    "name": "probabilities",
                                                    "plural": true,
                                                    "selections": [
                                                      {
                                                        "alias": null,
                                                        "args": null,
                                                        "kind": "ScalarField",
                                                        "name": "level",
                                                        "storageKey": null
                                                      },
                                                      (v18/*:: as any*/)
                                                    ],
                                                    "storageKey": null
                                                  }
                                                ],
                                                "type": "ScaleAnswer",
                                                "abstractKey": null
                                              }
                                            ],
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "requestedModel",
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "resolvedModel",
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
                                      },
                                      (v7/*:: as any*/),
                                      (v13/*:: as any*/),
                                      (v20/*:: as any*/),
                                      (v16/*:: as any*/),
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
                                        "name": "explanation",
                                        "storageKey": null
                                      },
                                      (v21/*:: as any*/),
                                      (v12/*:: as any*/)
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
                  },
                  (v7/*:: as any*/)
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
                "concreteType": "ExperimentComparison",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v17/*:: as any*/),
                  (v7/*:: as any*/)
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
        "args": (v6/*:: as any*/),
        "filters": [
          "baseExperimentId",
          "compareExperimentIds",
          "filterCondition"
        ],
        "handle": "connection",
        "key": "ExperimentCompareTable_compareExperiments",
        "kind": "LinkedHandle",
        "name": "compareExperiments"
      },
      {
        "alias": "dataset",
        "args": [
          {
            "kind": "Variable",
            "name": "id",
            "variableName": "datasetId"
          }
        ],
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v17/*:: as any*/),
          (v7/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": [
                  {
                    "kind": "Variable",
                    "name": "filterIds",
                    "variableName": "experimentIds"
                  },
                  {
                    "kind": "Literal",
                    "name": "includeEphemeral",
                    "value": true
                  }
                ],
                "concreteType": "ExperimentConnection",
                "kind": "LinkedField",
                "name": "experiments",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "experiment",
                        "args": null,
                        "concreteType": "Experiment",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v7/*:: as any*/),
                          (v13/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "sequenceNumber",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "isBaseline",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "isEphemeral",
                            "storageKey": null
                          },
                          (v21/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DatasetVersion",
                            "kind": "LinkedField",
                            "name": "datasetVersion",
                            "plural": false,
                            "selections": (v22/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Project",
                            "kind": "LinkedField",
                            "name": "project",
                            "plural": false,
                            "selections": (v22/*:: as any*/),
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
                                  (v9/*:: as any*/),
                                  (v8/*:: as any*/)
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
                            "name": "averageRunLatencyMs",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "runCount",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "repetitions",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentAnnotationSummary",
                            "kind": "LinkedField",
                            "name": "annotationSummaries",
                            "plural": true,
                            "selections": (v11/*:: as any*/),
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
              {
                "alias": null,
                "args": [
                  {
                    "kind": "Literal",
                    "name": "first",
                    "value": 100
                  }
                ],
                "concreteType": "DatasetEvaluatorConnection",
                "kind": "LinkedField",
                "name": "datasetEvaluators",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetEvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DatasetEvaluator",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v13/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "evaluator",
                            "plural": false,
                            "selections": [
                              (v17/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "kind",
                                "storageKey": null
                              },
                              (v7/*:: as any*/)
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
                              (v17/*:: as any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v13/*:: as any*/),
                                  (v23/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CategoricalAnnotationValue",
                                    "kind": "LinkedField",
                                    "name": "values",
                                    "plural": true,
                                    "selections": [
                                      (v16/*:: as any*/),
                                      (v20/*:: as any*/)
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
                                  (v13/*:: as any*/),
                                  (v23/*:: as any*/),
                                  (v24/*:: as any*/),
                                  (v25/*:: as any*/)
                                ],
                                "type": "ContinuousAnnotationConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v13/*:: as any*/),
                                  (v23/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "threshold",
                                    "storageKey": null
                                  },
                                  (v24/*:: as any*/),
                                  (v25/*:: as any*/)
                                ],
                                "type": "FreeformAnnotationConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": (v22/*:: as any*/),
                                "type": "Node",
                                "abstractKey": "__isNode"
                              }
                            ],
                            "storageKey": null
                          },
                          (v7/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "datasetEvaluators(first:100)"
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "c2ca15be0a9e995e21063584caacd2f7",
    "id": null,
    "metadata": {},
    "name": "ExperimentComparePageQueriesCompareGridQuery",
    "operationKind": "query",
    "text": "query ExperimentComparePageQueriesCompareGridQuery(\n  $datasetId: ID!\n  $experimentIds: [ID!]!\n  $baseExperimentId: ID!\n  $compareExperimentIds: [ID!]!\n) {\n  ...ExperimentCompareTable_comparisons_4mFQqw\n}\n\nfragment ExperimentCompareTable_comparisons_4mFQqw on Query {\n  compareExperiments(first: 50, baseExperimentId: $baseExperimentId, compareExperimentIds: $compareExperimentIds) {\n    edges {\n      comparison: node {\n        example {\n          id\n          externalId\n          revision {\n            input\n            referenceOutput: output\n          }\n        }\n        repeatedRunGroups {\n          ...ExperimentRepeatedRunGroupMetadataFragment\n          annotationSummaries {\n            annotationName\n            meanScore\n          }\n          experimentId\n          runs {\n            id\n            latencyMs\n            repetitionNumber\n            output\n            error\n            trace {\n              traceId\n              projectId\n              id\n            }\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n            }\n            annotations {\n              edges {\n                annotation: node {\n                  decision {\n                    status\n                    question {\n                      name\n                      type\n                      choices {\n                        value\n                        description\n                      }\n                      levels {\n                        label\n                        description\n                      }\n                    }\n                    answer {\n                      __typename\n                      ... on PredicateAnswer {\n                        probability\n                      }\n                      ... on ChoiceAnswer {\n                        choice\n                        confidence\n                        choiceProbabilities: probabilities {\n                          value\n                          probability\n                        }\n                      }\n                      ... on ScaleAnswer {\n                        expectedLevel\n                        confidence\n                        levelProbabilities: probabilities {\n                          level\n                          probability\n                        }\n                      }\n                    }\n                    requestedModel\n                    resolvedModel\n                    modelProvider\n                  }\n                  id\n                  name\n                  score\n                  label\n                  annotatorKind\n                  explanation\n                  metadata\n                  trace {\n                    traceId\n                    projectId\n                    id\n                  }\n                }\n              }\n            }\n          }\n          id\n        }\n        id\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      experiments(filterIds: $experimentIds, includeEphemeral: true) {\n        edges {\n          experiment: node {\n            id\n            name\n            sequenceNumber\n            isBaseline\n            isEphemeral\n            metadata\n            datasetVersion {\n              id\n            }\n            project {\n              id\n            }\n            costSummary {\n              total {\n                cost\n                tokens\n              }\n            }\n            averageRunLatencyMs\n            runCount\n            repetitions\n            annotationSummaries {\n              annotationName\n              meanScore\n            }\n          }\n        }\n      }\n      datasetEvaluators(first: 100) {\n        edges {\n          node {\n            name\n            evaluator {\n              __typename\n              kind\n              id\n            }\n            outputConfigs {\n              __typename\n              ... on CategoricalAnnotationConfig {\n                name\n                optimizationDirection\n                values {\n                  label\n                  score\n                }\n              }\n              ... on ContinuousAnnotationConfig {\n                name\n                optimizationDirection\n                lowerBound\n                upperBound\n              }\n              ... on FreeformAnnotationConfig {\n                name\n                optimizationDirection\n                threshold\n                lowerBound\n                upperBound\n              }\n              ... on Node {\n                __isNode: __typename\n                id\n              }\n            }\n            id\n          }\n        }\n      }\n    }\n  }\n}\n\nfragment ExperimentRepeatedRunGroupMetadataFragment on ExperimentRepeatedRunGroup {\n  id\n  averageLatencyMs\n  costSummary {\n    total {\n      tokens\n      cost\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a328b01cd5bf68e34f987eb2eaa5bea4";

export default node;
