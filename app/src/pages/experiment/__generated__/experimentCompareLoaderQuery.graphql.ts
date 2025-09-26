/**
 * @generated SignedSource<<12e36928a193e1fae7a6f5d0dbc34e14>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type experimentCompareLoaderQuery$variables = {
  baseExperimentId: string;
  compareExperimentIds: ReadonlyArray<string>;
  datasetId: string;
  experimentIds: ReadonlyArray<string>;
  hasCompareExperiments: boolean;
  includeGridView: boolean;
  includeListView: boolean;
  includeMetricsView: boolean;
};
export type experimentCompareLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareListPage_aggregateData" | "ExperimentCompareListPage_comparisons" | "ExperimentCompareMetricsPage_experiments" | "ExperimentComparePage_selectedCompareExperiments" | "ExperimentCompareTable_comparisons">;
};
export type experimentCompareLoaderQuery = {
  response: experimentCompareLoaderQuery$data;
  variables: experimentCompareLoaderQuery$variables;
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
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasCompareExperiments"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "includeGridView"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "includeListView"
},
v7 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "includeMetricsView"
},
v8 = {
  "kind": "Variable",
  "name": "datasetId",
  "variableName": "datasetId"
},
v9 = {
  "kind": "Variable",
  "name": "experimentIds",
  "variableName": "experimentIds"
},
v10 = [
  (v8/*: any*/),
  (v9/*: any*/)
],
v11 = {
  "kind": "Variable",
  "name": "baseExperimentId",
  "variableName": "baseExperimentId"
},
v12 = {
  "kind": "Variable",
  "name": "compareExperimentIds",
  "variableName": "compareExperimentIds"
},
v13 = [
  (v11/*: any*/),
  (v12/*: any*/)
],
v14 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v16 = [
  {
    "kind": "Variable",
    "name": "filterIds",
    "variableName": "experimentIds"
  }
],
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v19 = {
  "kind": "Literal",
  "name": "first",
  "value": 50
},
v20 = [
  (v11/*: any*/),
  (v12/*: any*/),
  (v19/*: any*/)
],
v21 = {
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
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokens",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v24 = [
  (v22/*: any*/),
  (v23/*: any*/)
],
v25 = {
  "alias": null,
  "args": null,
  "concreteType": "CostBreakdown",
  "kind": "LinkedField",
  "name": "total",
  "plural": false,
  "selections": (v24/*: any*/),
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanCostSummary",
  "kind": "LinkedField",
  "name": "costSummary",
  "plural": false,
  "selections": [
    (v25/*: any*/)
  ],
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationName",
  "storageKey": null
},
v28 = [
  (v27/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "meanScore",
    "storageKey": null
  }
],
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "experimentId",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
},
v31 = {
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
    (v17/*: any*/)
  ],
  "storageKey": null
},
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v33 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v35 = [
  (v15/*: any*/),
  (v17/*: any*/)
],
v36 = {
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
v37 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "datasetVersionId",
  "storageKey": null
},
v38 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "averageRunLatencyMs",
  "storageKey": null
},
v39 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "runCount",
  "storageKey": null
},
v40 = [
  (v19/*: any*/)
],
v41 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v42 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endTime",
  "storageKey": null
},
v43 = {
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
            (v18/*: any*/),
            (v32/*: any*/),
            (v33/*: any*/),
            (v17/*: any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v44 = {
  "alias": null,
  "args": null,
  "concreteType": "ExperimentAnnotationSummary",
  "kind": "LinkedField",
  "name": "annotationSummaries",
  "plural": true,
  "selections": (v28/*: any*/),
  "storageKey": null
},
v45 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "numRunsImproved",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "numRunsRegressed",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "numRunsEqual",
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
      (v4/*: any*/),
      (v5/*: any*/),
      (v6/*: any*/),
      (v7/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "experimentCompareLoaderQuery",
    "selections": [
      {
        "args": (v10/*: any*/),
        "kind": "FragmentSpread",
        "name": "ExperimentComparePage_selectedCompareExperiments"
      },
      {
        "condition": "includeGridView",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "args": [
              (v11/*: any*/),
              (v12/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/)
            ],
            "kind": "FragmentSpread",
            "name": "ExperimentCompareTable_comparisons"
          }
        ]
      },
      {
        "condition": "includeListView",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "args": (v13/*: any*/),
            "kind": "FragmentSpread",
            "name": "ExperimentCompareListPage_comparisons"
          },
          {
            "args": (v10/*: any*/),
            "kind": "FragmentSpread",
            "name": "ExperimentCompareListPage_aggregateData"
          }
        ]
      },
      {
        "condition": "includeMetricsView",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "args": [
              (v11/*: any*/),
              (v12/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              {
                "kind": "Variable",
                "name": "hasCompareExperiments",
                "variableName": "hasCompareExperiments"
              }
            ],
            "kind": "FragmentSpread",
            "name": "ExperimentCompareMetricsPage_experiments"
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/),
      (v6/*: any*/),
      (v7/*: any*/)
    ],
    "kind": "Operation",
    "name": "experimentCompareLoaderQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v14/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v15/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v16/*: any*/),
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
                          (v17/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "sequenceNumber",
                            "storageKey": null
                          },
                          (v18/*: any*/)
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
            "type": "Dataset",
            "abstractKey": null
          },
          (v17/*: any*/)
        ],
        "storageKey": null
      },
      {
        "condition": "includeGridView",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v20/*: any*/),
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
                          (v17/*: any*/),
                          (v21/*: any*/)
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
                          (v17/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "averageLatencyMs",
                            "storageKey": null
                          },
                          (v26/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentRepeatedRunGroupAnnotationSummary",
                            "kind": "LinkedField",
                            "name": "annotationSummaries",
                            "plural": true,
                            "selections": (v28/*: any*/),
                            "storageKey": null
                          },
                          (v29/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentRun",
                            "kind": "LinkedField",
                            "name": "runs",
                            "plural": true,
                            "selections": [
                              (v17/*: any*/),
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
                              (v30/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "error",
                                "storageKey": null
                              },
                              (v31/*: any*/),
                              (v26/*: any*/),
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
                                          (v17/*: any*/),
                                          (v18/*: any*/),
                                          (v32/*: any*/),
                                          (v33/*: any*/),
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
                                          (v31/*: any*/)
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
                      (v17/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v34/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentComparison",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": (v35/*: any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v36/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": (v20/*: any*/),
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
            "args": (v14/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": (v16/*: any*/),
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
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "metadata",
                                "storageKey": null
                              },
                              (v37/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Project",
                                "kind": "LinkedField",
                                "name": "project",
                                "plural": false,
                                "selections": [
                                  (v17/*: any*/)
                                ],
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
                                      (v23/*: any*/),
                                      (v22/*: any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              (v38/*: any*/),
                              (v39/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "repetitions",
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
                "type": "Dataset",
                "abstractKey": null
              }
            ],
            "storageKey": null
          }
        ]
      },
      {
        "condition": "includeListView",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "experiment",
            "args": [
              {
                "kind": "Variable",
                "name": "id",
                "variableName": "baseExperimentId"
              }
            ],
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v15/*: any*/),
              (v17/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": (v40/*: any*/),
                    "concreteType": "ExperimentRunConnection",
                    "kind": "LinkedField",
                    "name": "runs",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExperimentRunEdge",
                        "kind": "LinkedField",
                        "name": "edges",
                        "plural": true,
                        "selections": [
                          {
                            "alias": "run",
                            "args": null,
                            "concreteType": "ExperimentRun",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": [
                              (v17/*: any*/),
                              (v30/*: any*/),
                              (v41/*: any*/),
                              (v42/*: any*/),
                              (v26/*: any*/),
                              (v43/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "DatasetExample",
                                "kind": "LinkedField",
                                "name": "example",
                                "plural": false,
                                "selections": [
                                  (v17/*: any*/),
                                  (v21/*: any*/),
                                  {
                                    "alias": null,
                                    "args": [
                                      {
                                        "kind": "Variable",
                                        "name": "experimentIds",
                                        "variableName": "compareExperimentIds"
                                      }
                                    ],
                                    "concreteType": "ExperimentRepeatedRunGroup",
                                    "kind": "LinkedField",
                                    "name": "experimentRepeatedRunGroups",
                                    "plural": true,
                                    "selections": [
                                      (v29/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "ExperimentRun",
                                        "kind": "LinkedField",
                                        "name": "runs",
                                        "plural": true,
                                        "selections": [
                                          (v17/*: any*/),
                                          (v30/*: any*/),
                                          (v41/*: any*/),
                                          (v42/*: any*/),
                                          (v26/*: any*/),
                                          (v43/*: any*/)
                                        ],
                                        "storageKey": null
                                      },
                                      (v17/*: any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v34/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentRun",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": (v35/*: any*/),
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      (v36/*: any*/)
                    ],
                    "storageKey": "runs(first:50)"
                  },
                  {
                    "alias": null,
                    "args": (v40/*: any*/),
                    "filters": null,
                    "handle": "connection",
                    "key": "ExperimentCompareListPage_runs",
                    "kind": "LinkedHandle",
                    "name": "runs"
                  }
                ],
                "type": "Experiment",
                "abstractKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": "dataset",
            "args": (v14/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetExperimentAnnotationSummary",
                    "kind": "LinkedField",
                    "name": "experimentAnnotationSummaries",
                    "plural": true,
                    "selections": [
                      (v27/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "minScore",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "maxScore",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": (v16/*: any*/),
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
                              (v37/*: any*/),
                              (v38/*: any*/),
                              (v39/*: any*/),
                              (v26/*: any*/),
                              (v44/*: any*/)
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
                "type": "Dataset",
                "abstractKey": null
              }
            ],
            "storageKey": null
          }
        ]
      },
      {
        "condition": "includeMetricsView",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "dataset",
            "args": (v14/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": (v16/*: any*/),
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
                              (v38/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanCostSummary",
                                "kind": "LinkedField",
                                "name": "costSummary",
                                "plural": false,
                                "selections": [
                                  (v25/*: any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CostBreakdown",
                                    "kind": "LinkedField",
                                    "name": "prompt",
                                    "plural": false,
                                    "selections": (v24/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CostBreakdown",
                                    "kind": "LinkedField",
                                    "name": "completion",
                                    "plural": false,
                                    "selections": (v24/*: any*/),
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              (v44/*: any*/)
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
                "type": "Dataset",
                "abstractKey": null
              }
            ],
            "storageKey": null
          },
          {
            "condition": "hasCompareExperiments",
            "kind": "Condition",
            "passingValue": true,
            "selections": [
              {
                "alias": null,
                "args": (v13/*: any*/),
                "concreteType": "ExperimentRunMetricComparisons",
                "kind": "LinkedField",
                "name": "experimentRunMetricComparisons",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunMetricComparison",
                    "kind": "LinkedField",
                    "name": "latency",
                    "plural": false,
                    "selections": (v45/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunMetricComparison",
                    "kind": "LinkedField",
                    "name": "totalTokenCount",
                    "plural": false,
                    "selections": (v45/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunMetricComparison",
                    "kind": "LinkedField",
                    "name": "promptTokenCount",
                    "plural": false,
                    "selections": (v45/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunMetricComparison",
                    "kind": "LinkedField",
                    "name": "completionTokenCount",
                    "plural": false,
                    "selections": (v45/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunMetricComparison",
                    "kind": "LinkedField",
                    "name": "totalCost",
                    "plural": false,
                    "selections": (v45/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunMetricComparison",
                    "kind": "LinkedField",
                    "name": "promptCost",
                    "plural": false,
                    "selections": (v45/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunMetricComparison",
                    "kind": "LinkedField",
                    "name": "completionCost",
                    "plural": false,
                    "selections": (v45/*: any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ]
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "7f3a644cd3fe041fc3c72464c6b2ba89",
    "id": null,
    "metadata": {},
    "name": "experimentCompareLoaderQuery",
    "operationKind": "query",
    "text": "query experimentCompareLoaderQuery(\n  $datasetId: ID!\n  $baseExperimentId: ID!\n  $compareExperimentIds: [ID!]!\n  $experimentIds: [ID!]!\n  $hasCompareExperiments: Boolean!\n  $includeGridView: Boolean!\n  $includeListView: Boolean!\n  $includeMetricsView: Boolean!\n) {\n  ...ExperimentComparePage_selectedCompareExperiments_3xL6z4\n  ...ExperimentCompareTable_comparisons_4mFQqw @include(if: $includeGridView)\n  ...ExperimentCompareListPage_comparisons_2bWqNi @include(if: $includeListView)\n  ...ExperimentCompareListPage_aggregateData_3xL6z4 @include(if: $includeListView)\n  ...ExperimentCompareMetricsPage_experiments_4DSN89 @include(if: $includeMetricsView)\n}\n\nfragment ExperimentCompareListPage_aggregateData_3xL6z4 on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      id\n      experimentAnnotationSummaries {\n        annotationName\n        minScore\n        maxScore\n      }\n      experiments(filterIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            datasetVersionId\n            averageRunLatencyMs\n            runCount\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n            }\n            annotationSummaries {\n              annotationName\n              meanScore\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ExperimentCompareListPage_comparisons_2bWqNi on Query {\n  experiment: node(id: $baseExperimentId) {\n    __typename\n    ... on Experiment {\n      id\n      runs(first: 50) {\n        edges {\n          run: node {\n            id\n            output\n            startTime\n            endTime\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n            }\n            annotations {\n              edges {\n                annotation: node {\n                  name\n                  score\n                  label\n                  id\n                }\n              }\n            }\n            example {\n              id\n              revision {\n                input\n                referenceOutput: output\n              }\n              experimentRepeatedRunGroups(experimentIds: $compareExperimentIds) {\n                experimentId\n                runs {\n                  id\n                  output\n                  startTime\n                  endTime\n                  costSummary {\n                    total {\n                      tokens\n                      cost\n                    }\n                  }\n                  annotations {\n                    edges {\n                      annotation: node {\n                        name\n                        score\n                        label\n                        id\n                      }\n                    }\n                  }\n                }\n                id\n              }\n            }\n          }\n          cursor\n          node {\n            __typename\n            id\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ExperimentCompareMetricsPage_experiments_4DSN89 on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      experiments(filterIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            averageRunLatencyMs\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n              prompt {\n                tokens\n                cost\n              }\n              completion {\n                tokens\n                cost\n              }\n            }\n            annotationSummaries {\n              annotationName\n              meanScore\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n  experimentRunMetricComparisons(baseExperimentId: $baseExperimentId, compareExperimentIds: $compareExperimentIds) @include(if: $hasCompareExperiments) {\n    latency {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    totalTokenCount {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    promptTokenCount {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    completionTokenCount {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    totalCost {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    promptCost {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    completionCost {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n  }\n}\n\nfragment ExperimentComparePage_selectedCompareExperiments_3xL6z4 on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      experiments(filterIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            sequenceNumber\n            name\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ExperimentCompareTable_comparisons_4mFQqw on Query {\n  compareExperiments(first: 50, baseExperimentId: $baseExperimentId, compareExperimentIds: $compareExperimentIds) {\n    edges {\n      comparison: node {\n        example {\n          id\n          revision {\n            input\n            referenceOutput: output\n          }\n        }\n        repeatedRunGroups {\n          ...ExperimentRepeatedRunGroupMetadataFragment\n          annotationSummaries {\n            annotationName\n            meanScore\n          }\n          experimentId\n          runs {\n            id\n            latencyMs\n            repetitionNumber\n            output\n            error\n            trace {\n              traceId\n              projectId\n              id\n            }\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n            }\n            annotations {\n              edges {\n                annotation: node {\n                  id\n                  name\n                  score\n                  label\n                  annotatorKind\n                  explanation\n                  trace {\n                    traceId\n                    projectId\n                    id\n                  }\n                }\n              }\n            }\n          }\n          id\n        }\n        id\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      experiments(filterIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            name\n            sequenceNumber\n            metadata\n            datasetVersionId\n            project {\n              id\n            }\n            costSummary {\n              total {\n                cost\n                tokens\n              }\n            }\n            averageRunLatencyMs\n            runCount\n            repetitions\n          }\n        }\n      }\n    }\n  }\n}\n\nfragment ExperimentRepeatedRunGroupMetadataFragment on ExperimentRepeatedRunGroup {\n  id\n  averageLatencyMs\n  costSummary {\n    total {\n      tokens\n      cost\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9831732b0811fd7d45fb1571425a5a02";

export default node;
