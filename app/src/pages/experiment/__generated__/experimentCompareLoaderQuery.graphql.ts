/**
 * @generated SignedSource<<8e0a30c589c1b7ff6ebd91f3f60c56fc>>
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
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareListPage_aggregateData" | "ExperimentCompareListPage_comparisons" | "ExperimentCompareMetricsPage_experiments" | "ExperimentCompareTable_comparisons">;
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
  "name": "baseExperimentId",
  "variableName": "baseExperimentId"
},
v9 = {
  "kind": "Variable",
  "name": "compareExperimentIds",
  "variableName": "compareExperimentIds"
},
v10 = {
  "kind": "Variable",
  "name": "datasetId",
  "variableName": "datasetId"
},
v11 = {
  "kind": "Variable",
  "name": "experimentIds",
  "variableName": "experimentIds"
},
v12 = [
  (v8/*: any*/),
  (v9/*: any*/)
],
v13 = {
  "kind": "Literal",
  "name": "first",
  "value": 50
},
v14 = [
  (v8/*: any*/),
  (v9/*: any*/),
  (v13/*: any*/)
],
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v16 = {
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
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokens",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v19 = [
  (v17/*: any*/),
  (v18/*: any*/)
],
v20 = {
  "alias": null,
  "args": null,
  "concreteType": "CostBreakdown",
  "kind": "LinkedField",
  "name": "total",
  "plural": false,
  "selections": (v19/*: any*/),
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanCostSummary",
  "kind": "LinkedField",
  "name": "costSummary",
  "plural": false,
  "selections": [
    (v20/*: any*/)
  ],
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationName",
  "storageKey": null
},
v23 = [
  (v22/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "meanScore",
    "storageKey": null
  }
],
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "experimentId",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
},
v26 = {
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
    (v15/*: any*/)
  ],
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v32 = [
  (v31/*: any*/),
  (v15/*: any*/)
],
v33 = {
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
v34 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v35 = [
  {
    "kind": "Variable",
    "name": "filterIds",
    "variableName": "experimentIds"
  }
],
v36 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "datasetVersionId",
  "storageKey": null
},
v37 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "averageRunLatencyMs",
  "storageKey": null
},
v38 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "runCount",
  "storageKey": null
},
v39 = [
  (v13/*: any*/)
],
v40 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v41 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endTime",
  "storageKey": null
},
v42 = {
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
            (v27/*: any*/),
            (v28/*: any*/),
            (v29/*: any*/),
            (v15/*: any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v43 = {
  "alias": null,
  "args": null,
  "concreteType": "ExperimentAnnotationSummary",
  "kind": "LinkedField",
  "name": "annotationSummaries",
  "plural": true,
  "selections": (v23/*: any*/),
  "storageKey": null
},
v44 = [
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
        "condition": "includeGridView",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "args": [
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/)
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
            "args": (v12/*: any*/),
            "kind": "FragmentSpread",
            "name": "ExperimentCompareListPage_comparisons"
          },
          {
            "args": [
              (v10/*: any*/),
              (v11/*: any*/)
            ],
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
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/),
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
        "condition": "includeGridView",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v14/*: any*/),
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
                          (v15/*: any*/),
                          (v16/*: any*/)
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
                          (v15/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "averageLatencyMs",
                            "storageKey": null
                          },
                          (v21/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentRepeatedRunGroupAnnotationSummary",
                            "kind": "LinkedField",
                            "name": "annotationSummaries",
                            "plural": true,
                            "selections": (v23/*: any*/),
                            "storageKey": null
                          },
                          (v24/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentRun",
                            "kind": "LinkedField",
                            "name": "runs",
                            "plural": true,
                            "selections": [
                              (v15/*: any*/),
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
                              (v25/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "error",
                                "storageKey": null
                              },
                              (v26/*: any*/),
                              (v21/*: any*/),
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
                                          (v15/*: any*/),
                                          (v27/*: any*/),
                                          (v28/*: any*/),
                                          (v29/*: any*/),
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
                                          (v26/*: any*/)
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
                      (v15/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v30/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentComparison",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": (v32/*: any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v33/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": (v14/*: any*/),
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
            "args": (v34/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v31/*: any*/),
              (v15/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": (v35/*: any*/),
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
                              (v15/*: any*/),
                              (v27/*: any*/),
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
                                "name": "metadata",
                                "storageKey": null
                              },
                              (v36/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Project",
                                "kind": "LinkedField",
                                "name": "project",
                                "plural": false,
                                "selections": [
                                  (v15/*: any*/)
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
                                      (v18/*: any*/),
                                      (v17/*: any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              (v37/*: any*/),
                              (v38/*: any*/),
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
              (v31/*: any*/),
              (v15/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": (v39/*: any*/),
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
                              (v15/*: any*/),
                              (v25/*: any*/),
                              (v40/*: any*/),
                              (v41/*: any*/),
                              (v21/*: any*/),
                              (v42/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "DatasetExample",
                                "kind": "LinkedField",
                                "name": "example",
                                "plural": false,
                                "selections": [
                                  (v15/*: any*/),
                                  (v16/*: any*/),
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
                                      (v24/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "ExperimentRun",
                                        "kind": "LinkedField",
                                        "name": "runs",
                                        "plural": true,
                                        "selections": [
                                          (v15/*: any*/),
                                          (v25/*: any*/),
                                          (v40/*: any*/),
                                          (v41/*: any*/),
                                          (v21/*: any*/),
                                          (v42/*: any*/)
                                        ],
                                        "storageKey": null
                                      },
                                      (v15/*: any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v30/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentRun",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": (v32/*: any*/),
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      (v33/*: any*/)
                    ],
                    "storageKey": "runs(first:50)"
                  },
                  {
                    "alias": null,
                    "args": (v39/*: any*/),
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
            "args": (v34/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v31/*: any*/),
              (v15/*: any*/),
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
                      (v22/*: any*/),
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
                    "args": (v35/*: any*/),
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
                              (v15/*: any*/),
                              (v36/*: any*/),
                              (v37/*: any*/),
                              (v38/*: any*/),
                              (v21/*: any*/),
                              (v43/*: any*/)
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
            "args": (v34/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v31/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": (v35/*: any*/),
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
                              (v15/*: any*/),
                              (v37/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanCostSummary",
                                "kind": "LinkedField",
                                "name": "costSummary",
                                "plural": false,
                                "selections": [
                                  (v20/*: any*/),
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
                              (v43/*: any*/)
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
              (v15/*: any*/)
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
                "args": (v12/*: any*/),
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
                    "selections": (v44/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunMetricComparison",
                    "kind": "LinkedField",
                    "name": "totalTokenCount",
                    "plural": false,
                    "selections": (v44/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunMetricComparison",
                    "kind": "LinkedField",
                    "name": "promptTokenCount",
                    "plural": false,
                    "selections": (v44/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunMetricComparison",
                    "kind": "LinkedField",
                    "name": "completionTokenCount",
                    "plural": false,
                    "selections": (v44/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunMetricComparison",
                    "kind": "LinkedField",
                    "name": "totalCost",
                    "plural": false,
                    "selections": (v44/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunMetricComparison",
                    "kind": "LinkedField",
                    "name": "promptCost",
                    "plural": false,
                    "selections": (v44/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunMetricComparison",
                    "kind": "LinkedField",
                    "name": "completionCost",
                    "plural": false,
                    "selections": (v44/*: any*/),
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
    "cacheID": "d0681ec6064602e98a37139f7891549d",
    "id": null,
    "metadata": {},
    "name": "experimentCompareLoaderQuery",
    "operationKind": "query",
    "text": "query experimentCompareLoaderQuery(\n  $datasetId: ID!\n  $baseExperimentId: ID!\n  $compareExperimentIds: [ID!]!\n  $experimentIds: [ID!]!\n  $hasCompareExperiments: Boolean!\n  $includeGridView: Boolean!\n  $includeListView: Boolean!\n  $includeMetricsView: Boolean!\n) {\n  ...ExperimentCompareTable_comparisons_4mFQqw @include(if: $includeGridView)\n  ...ExperimentCompareListPage_comparisons_2bWqNi @include(if: $includeListView)\n  ...ExperimentCompareListPage_aggregateData_3xL6z4 @include(if: $includeListView)\n  ...ExperimentCompareMetricsPage_experiments_4DSN89 @include(if: $includeMetricsView)\n}\n\nfragment ExperimentCompareListPage_aggregateData_3xL6z4 on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      id\n      experimentAnnotationSummaries {\n        annotationName\n        minScore\n        maxScore\n      }\n      experiments(filterIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            datasetVersionId\n            averageRunLatencyMs\n            runCount\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n            }\n            annotationSummaries {\n              annotationName\n              meanScore\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ExperimentCompareListPage_comparisons_2bWqNi on Query {\n  experiment: node(id: $baseExperimentId) {\n    __typename\n    ... on Experiment {\n      id\n      runs(first: 50) {\n        edges {\n          run: node {\n            id\n            output\n            startTime\n            endTime\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n            }\n            annotations {\n              edges {\n                annotation: node {\n                  name\n                  score\n                  label\n                  id\n                }\n              }\n            }\n            example {\n              id\n              revision {\n                input\n                referenceOutput: output\n              }\n              experimentRepeatedRunGroups(experimentIds: $compareExperimentIds) {\n                experimentId\n                runs {\n                  id\n                  output\n                  startTime\n                  endTime\n                  costSummary {\n                    total {\n                      tokens\n                      cost\n                    }\n                  }\n                  annotations {\n                    edges {\n                      annotation: node {\n                        name\n                        score\n                        label\n                        id\n                      }\n                    }\n                  }\n                }\n                id\n              }\n            }\n          }\n          cursor\n          node {\n            __typename\n            id\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ExperimentCompareMetricsPage_experiments_4DSN89 on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      experiments(filterIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            averageRunLatencyMs\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n              prompt {\n                tokens\n                cost\n              }\n              completion {\n                tokens\n                cost\n              }\n            }\n            annotationSummaries {\n              annotationName\n              meanScore\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n  experimentRunMetricComparisons(baseExperimentId: $baseExperimentId, compareExperimentIds: $compareExperimentIds) @include(if: $hasCompareExperiments) {\n    latency {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    totalTokenCount {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    promptTokenCount {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    completionTokenCount {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    totalCost {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    promptCost {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    completionCost {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n  }\n}\n\nfragment ExperimentCompareTable_comparisons_4mFQqw on Query {\n  compareExperiments(first: 50, baseExperimentId: $baseExperimentId, compareExperimentIds: $compareExperimentIds) {\n    edges {\n      comparison: node {\n        example {\n          id\n          revision {\n            input\n            referenceOutput: output\n          }\n        }\n        repeatedRunGroups {\n          ...ExperimentRepeatedRunGroupMetadataFragment\n          annotationSummaries {\n            annotationName\n            meanScore\n          }\n          experimentId\n          runs {\n            id\n            latencyMs\n            repetitionNumber\n            output\n            error\n            trace {\n              traceId\n              projectId\n              id\n            }\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n            }\n            annotations {\n              edges {\n                annotation: node {\n                  id\n                  name\n                  score\n                  label\n                  annotatorKind\n                  explanation\n                  trace {\n                    traceId\n                    projectId\n                    id\n                  }\n                }\n              }\n            }\n          }\n          id\n        }\n        id\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      experiments(filterIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            name\n            sequenceNumber\n            metadata\n            datasetVersionId\n            project {\n              id\n            }\n            costSummary {\n              total {\n                cost\n                tokens\n              }\n            }\n            averageRunLatencyMs\n            runCount\n            repetitions\n          }\n        }\n      }\n    }\n  }\n}\n\nfragment ExperimentRepeatedRunGroupMetadataFragment on ExperimentRepeatedRunGroup {\n  id\n  averageLatencyMs\n  costSummary {\n    total {\n      tokens\n      cost\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6c3f5e078d7bed0cc51b4c13f4b0effe";

export default node;
