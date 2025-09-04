/**
 * @generated SignedSource<<4c533fdc5110ff386d4b338bd0c984ac>>
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
  datasetVersionId: string;
  experimentIds: ReadonlyArray<string>;
  hasBaseExperiment: boolean;
  hasCompareExperiments: boolean;
  includeGridView: boolean;
  includeListView: boolean;
  includeMetricsView: boolean;
};
export type experimentCompareLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareListPage_aggregateData" | "ExperimentCompareListPage_comparisons" | "ExperimentCompareMetricsPage_experiments" | "ExperimentComparePage_selectedCompareExperiments" | "ExperimentCompareTable_comparisons" | "ExperimentMultiSelector__data">;
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
  "name": "datasetVersionId"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "experimentIds"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasBaseExperiment"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasCompareExperiments"
},
v7 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "includeGridView"
},
v8 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "includeListView"
},
v9 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "includeMetricsView"
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
  (v10/*: any*/),
  (v11/*: any*/)
],
v13 = {
  "kind": "Variable",
  "name": "datasetVersionId",
  "variableName": "datasetVersionId"
},
v14 = {
  "kind": "Variable",
  "name": "baseExperimentId",
  "variableName": "baseExperimentId"
},
v15 = {
  "kind": "Variable",
  "name": "compareExperimentIds",
  "variableName": "compareExperimentIds"
},
v16 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
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
  "name": "id",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sequenceNumber",
  "storageKey": null
},
v21 = [
  (v11/*: any*/)
],
v22 = {
  "kind": "Literal",
  "name": "first",
  "value": 50
},
v23 = [
  (v13/*: any*/),
  (v22/*: any*/)
],
v24 = {
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
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "runCount",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endTime",
  "storageKey": null
},
v29 = {
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
    (v18/*: any*/)
  ],
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokens",
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v32 = [
  (v30/*: any*/),
  (v31/*: any*/)
],
v33 = {
  "alias": null,
  "args": null,
  "concreteType": "CostBreakdown",
  "kind": "LinkedField",
  "name": "total",
  "plural": false,
  "selections": (v32/*: any*/),
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanCostSummary",
  "kind": "LinkedField",
  "name": "costSummary",
  "plural": false,
  "selections": [
    (v33/*: any*/)
  ],
  "storageKey": null
},
v35 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v36 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v37 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v38 = [
  (v17/*: any*/),
  (v18/*: any*/)
],
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
v40 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "averageRunLatencyMs",
  "storageKey": null
},
v41 = [
  (v14/*: any*/),
  (v15/*: any*/),
  (v22/*: any*/)
],
v42 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationName",
  "storageKey": null
},
v43 = {
  "alias": null,
  "args": null,
  "concreteType": "ExperimentAnnotationSummary",
  "kind": "LinkedField",
  "name": "annotationSummaries",
  "plural": true,
  "selections": [
    (v42/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "meanScore",
      "storageKey": null
    }
  ],
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
      (v7/*: any*/),
      (v8/*: any*/),
      (v9/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "experimentCompareLoaderQuery",
    "selections": [
      {
        "args": [
          (v10/*: any*/),
          {
            "kind": "Variable",
            "name": "hasBaseExperiment",
            "variableName": "hasBaseExperiment"
          }
        ],
        "kind": "FragmentSpread",
        "name": "ExperimentMultiSelector__data"
      },
      {
        "args": (v12/*: any*/),
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
              (v10/*: any*/),
              (v13/*: any*/),
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
            "args": [
              (v14/*: any*/)
            ],
            "kind": "FragmentSpread",
            "name": "ExperimentCompareListPage_comparisons"
          },
          {
            "args": (v12/*: any*/),
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
              (v14/*: any*/),
              (v15/*: any*/),
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
      (v3/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/),
      (v6/*: any*/),
      (v7/*: any*/),
      (v8/*: any*/),
      (v9/*: any*/)
    ],
    "kind": "Operation",
    "name": "experimentCompareLoaderQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v16/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v17/*: any*/),
          (v18/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v19/*: any*/),
              {
                "alias": "allExperiments",
                "args": null,
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
                          (v18/*: any*/),
                          (v19/*: any*/),
                          (v20/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "createdAt",
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
                "args": (v21/*: any*/),
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
                          (v18/*: any*/),
                          (v20/*: any*/),
                          (v19/*: any*/)
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
        "condition": "hasBaseExperiment",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "baseExperiment",
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
              (v17/*: any*/),
              (v18/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  (v19/*: any*/)
                ],
                "type": "Experiment",
                "abstractKey": null
              }
            ],
            "storageKey": null
          }
        ]
      },
      {
        "condition": "includeGridView",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "dataset",
            "args": (v16/*: any*/),
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
                    "args": (v23/*: any*/),
                    "concreteType": "DatasetExampleConnection",
                    "kind": "LinkedField",
                    "name": "examples",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DatasetExampleEdge",
                        "kind": "LinkedField",
                        "name": "edges",
                        "plural": true,
                        "selections": [
                          {
                            "alias": "example",
                            "args": null,
                            "concreteType": "DatasetExample",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": [
                              (v18/*: any*/),
                              (v24/*: any*/),
                              {
                                "alias": null,
                                "args": (v21/*: any*/),
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
                                          (v18/*: any*/),
                                          (v25/*: any*/),
                                          {
                                            "alias": null,
                                            "args": [
                                              {
                                                "kind": "Literal",
                                                "name": "first",
                                                "value": 5
                                              }
                                            ],
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
                                                      (v18/*: any*/),
                                                      (v26/*: any*/),
                                                      {
                                                        "alias": null,
                                                        "args": null,
                                                        "kind": "ScalarField",
                                                        "name": "error",
                                                        "storageKey": null
                                                      },
                                                      (v27/*: any*/),
                                                      (v28/*: any*/),
                                                      (v29/*: any*/),
                                                      (v34/*: any*/),
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
                                                                  (v18/*: any*/),
                                                                  (v19/*: any*/),
                                                                  (v35/*: any*/),
                                                                  (v36/*: any*/),
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
                                                                  (v29/*: any*/)
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
                                              }
                                            ],
                                            "storageKey": "runs(first:5)"
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
                          (v37/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DatasetExample",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": (v38/*: any*/),
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      (v39/*: any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": (v23/*: any*/),
                    "filters": [
                      "datasetVersionId",
                      "filterCondition"
                    ],
                    "handle": "connection",
                    "key": "ExperimentCompareTable_examples",
                    "kind": "LinkedHandle",
                    "name": "examples"
                  },
                  {
                    "alias": null,
                    "args": (v21/*: any*/),
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
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Project",
                                "kind": "LinkedField",
                                "name": "project",
                                "plural": false,
                                "selections": [
                                  (v18/*: any*/)
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
                                      (v31/*: any*/),
                                      (v30/*: any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              (v40/*: any*/),
                              (v25/*: any*/)
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
            "alias": null,
            "args": (v41/*: any*/),
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
                          (v18/*: any*/),
                          (v24/*: any*/)
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "RunComparisonItem",
                        "kind": "LinkedField",
                        "name": "runComparisonItems",
                        "plural": true,
                        "selections": [
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
                              (v26/*: any*/),
                              (v27/*: any*/),
                              (v28/*: any*/),
                              (v34/*: any*/),
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
                                          (v19/*: any*/),
                                          (v35/*: any*/),
                                          (v36/*: any*/),
                                          (v18/*: any*/)
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              (v18/*: any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      (v18/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v37/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentComparison",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": (v38/*: any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v39/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": (v41/*: any*/),
            "filters": [
              "baseExperimentId",
              "compareExperimentIds"
            ],
            "handle": "connection",
            "key": "ExperimentCompareListPage_compareExperiments",
            "kind": "LinkedHandle",
            "name": "compareExperiments"
          },
          {
            "alias": "dataset",
            "args": (v16/*: any*/),
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
                      (v42/*: any*/),
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
                    "args": (v21/*: any*/),
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
                              (v40/*: any*/),
                              (v34/*: any*/),
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
            "args": (v16/*: any*/),
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
                    "args": (v21/*: any*/),
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
                              (v40/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanCostSummary",
                                "kind": "LinkedField",
                                "name": "costSummary",
                                "plural": false,
                                "selections": [
                                  (v33/*: any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CostBreakdown",
                                    "kind": "LinkedField",
                                    "name": "prompt",
                                    "plural": false,
                                    "selections": (v32/*: any*/),
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CostBreakdown",
                                    "kind": "LinkedField",
                                    "name": "completion",
                                    "plural": false,
                                    "selections": (v32/*: any*/),
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
                "args": [
                  (v14/*: any*/),
                  (v15/*: any*/)
                ],
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
    "cacheID": "ad77a5bc269934f8589e56861bfd421f",
    "id": null,
    "metadata": {},
    "name": "experimentCompareLoaderQuery",
    "operationKind": "query",
    "text": "query experimentCompareLoaderQuery(\n  $datasetId: ID!\n  $datasetVersionId: ID!\n  $baseExperimentId: ID!\n  $compareExperimentIds: [ID!]!\n  $experimentIds: [ID!]!\n  $hasBaseExperiment: Boolean!\n  $hasCompareExperiments: Boolean!\n  $includeGridView: Boolean!\n  $includeListView: Boolean!\n  $includeMetricsView: Boolean!\n) {\n  ...ExperimentMultiSelector__data_4t6es6\n  ...ExperimentComparePage_selectedCompareExperiments_3xL6z4\n  ...ExperimentCompareTable_comparisons_po5sr @include(if: $includeGridView)\n  ...ExperimentCompareListPage_comparisons_2zjGQN @include(if: $includeListView)\n  ...ExperimentCompareListPage_aggregateData_3xL6z4 @include(if: $includeListView)\n  ...ExperimentCompareMetricsPage_experiments_4DSN89 @include(if: $includeMetricsView)\n}\n\nfragment ExperimentCompareListPage_aggregateData_3xL6z4 on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      experimentAnnotationSummaries {\n        annotationName\n        minScore\n        maxScore\n      }\n      experiments(experimentIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            averageRunLatencyMs\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n            }\n            annotationSummaries {\n              annotationName\n              meanScore\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ExperimentCompareListPage_comparisons_2zjGQN on Query {\n  compareExperiments(first: 50, baseExperimentId: $baseExperimentId, compareExperimentIds: $compareExperimentIds) {\n    edges {\n      comparison: node {\n        example {\n          id\n          revision {\n            input\n            referenceOutput: output\n          }\n        }\n        runComparisonItems {\n          experimentId\n          runs {\n            output\n            startTime\n            endTime\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n            }\n            annotations {\n              edges {\n                annotation: node {\n                  name\n                  score\n                  label\n                  id\n                }\n              }\n            }\n            id\n          }\n        }\n        id\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment ExperimentCompareMetricsPage_experiments_4DSN89 on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      experiments(experimentIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            averageRunLatencyMs\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n              prompt {\n                tokens\n                cost\n              }\n              completion {\n                tokens\n                cost\n              }\n            }\n            annotationSummaries {\n              annotationName\n              meanScore\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n  experimentRunMetricComparisons(baseExperimentId: $baseExperimentId, compareExperimentIds: $compareExperimentIds) @include(if: $hasCompareExperiments) {\n    latency {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    totalTokenCount {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    promptTokenCount {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    completionTokenCount {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    totalCost {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    promptCost {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    completionCost {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n  }\n}\n\nfragment ExperimentComparePage_selectedCompareExperiments_3xL6z4 on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      experiments(experimentIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            sequenceNumber\n            name\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ExperimentCompareTable_comparisons_po5sr on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      examples(first: 50, datasetVersionId: $datasetVersionId) {\n        edges {\n          example: node {\n            id\n            revision {\n              input\n              referenceOutput: output\n            }\n            experiments(experimentIds: $experimentIds) {\n              edges {\n                experiment: node {\n                  id\n                  runCount\n                  runs(first: 5) {\n                    edges {\n                      run: node {\n                        id\n                        output\n                        error\n                        startTime\n                        endTime\n                        trace {\n                          traceId\n                          projectId\n                          id\n                        }\n                        costSummary {\n                          total {\n                            tokens\n                            cost\n                          }\n                        }\n                        annotations {\n                          edges {\n                            annotation: node {\n                              id\n                              name\n                              score\n                              label\n                              annotatorKind\n                              explanation\n                              trace {\n                                traceId\n                                projectId\n                                id\n                              }\n                            }\n                          }\n                        }\n                      }\n                    }\n                  }\n                }\n              }\n            }\n          }\n          cursor\n          node {\n            __typename\n            id\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n      experiments(experimentIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            name\n            sequenceNumber\n            metadata\n            project {\n              id\n            }\n            costSummary {\n              total {\n                cost\n                tokens\n              }\n            }\n            averageRunLatencyMs\n            runCount\n          }\n        }\n      }\n    }\n  }\n}\n\nfragment ExperimentMultiSelector__data_4t6es6 on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      id\n      name\n      allExperiments: experiments {\n        edges {\n          experiment: node {\n            id\n            name\n            sequenceNumber\n            createdAt\n          }\n        }\n      }\n    }\n  }\n  baseExperiment: node(id: $baseExperimentId) @include(if: $hasBaseExperiment) {\n    __typename\n    ... on Experiment {\n      id\n      name\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "ccdc03f4fbb8578633be123249dfb4f9";

export default node;
