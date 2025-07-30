/**
 * @generated SignedSource<<030dc4a3d792c77865fb546cedcf5416>>
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
  firstCompareExperimentId: string;
  hasBaseExperiment: boolean;
  hasFirstCompareExperiment: boolean;
  hasSecondCompareExperiment: boolean;
  hasThirdCompareExperiment: boolean;
  isMetricsView: boolean;
  secondCompareExperimentId: string;
  thirdCompareExperimentId: string;
};
export type experimentCompareLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareMetricsPage_experiments" | "ExperimentCompareTable_comparisons" | "ExperimentMultiSelector__data">;
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
  "name": "firstCompareExperimentId"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasBaseExperiment"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasFirstCompareExperiment"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasSecondCompareExperiment"
},
v7 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasThirdCompareExperiment"
},
v8 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "isMetricsView"
},
v9 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "secondCompareExperimentId"
},
v10 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "thirdCompareExperimentId"
},
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
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
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
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v17 = [
  (v11/*: any*/),
  (v12/*: any*/),
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
],
v18 = {
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
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokens",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "concreteType": "CostBreakdown",
  "kind": "LinkedField",
  "name": "total",
  "plural": false,
  "selections": [
    (v19/*: any*/),
    (v20/*: any*/)
  ],
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "averageRunLatencyMs",
  "storageKey": null
},
v23 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "baseExperimentId"
  }
],
v24 = [
  (v19/*: any*/)
],
v25 = [
  (v14/*: any*/),
  (v15/*: any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v22/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "SpanCostSummary",
        "kind": "LinkedField",
        "name": "costSummary",
        "plural": false,
        "selections": [
          (v21/*: any*/),
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
      {
        "alias": null,
        "args": null,
        "concreteType": "ExperimentAnnotationSummary",
        "kind": "LinkedField",
        "name": "annotationSummaries",
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
            "kind": "ScalarField",
            "name": "meanScore",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Experiment",
    "abstractKey": null
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
      (v9/*: any*/),
      (v10/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "experimentCompareLoaderQuery",
    "selections": [
      {
        "condition": "hasBaseExperiment",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "args": [
              (v11/*: any*/),
              (v12/*: any*/),
              {
                "kind": "Variable",
                "name": "datasetId",
                "variableName": "datasetId"
              }
            ],
            "kind": "FragmentSpread",
            "name": "ExperimentCompareTable_comparisons"
          }
        ]
      },
      {
        "args": [
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
        "condition": "isMetricsView",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "args": [
              (v11/*: any*/),
              {
                "kind": "Variable",
                "name": "firstCompareExperimentId",
                "variableName": "firstCompareExperimentId"
              },
              {
                "kind": "Variable",
                "name": "hasFirstCompareExperiment",
                "variableName": "hasFirstCompareExperiment"
              },
              {
                "kind": "Variable",
                "name": "hasSecondCompareExperiment",
                "variableName": "hasSecondCompareExperiment"
              },
              {
                "kind": "Variable",
                "name": "hasThirdCompareExperiment",
                "variableName": "hasThirdCompareExperiment"
              },
              {
                "kind": "Variable",
                "name": "secondCompareExperimentId",
                "variableName": "secondCompareExperimentId"
              },
              {
                "kind": "Variable",
                "name": "thirdCompareExperimentId",
                "variableName": "thirdCompareExperimentId"
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
      (v9/*: any*/),
      (v10/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/),
      (v6/*: any*/),
      (v7/*: any*/),
      (v8/*: any*/)
    ],
    "kind": "Operation",
    "name": "experimentCompareLoaderQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v13/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v14/*: any*/),
          (v15/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v16/*: any*/),
              {
                "alias": null,
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
                          (v15/*: any*/),
                          (v16/*: any*/),
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
            "alias": null,
            "args": (v17/*: any*/),
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
                              (v15/*: any*/),
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
                                "name": "endTime",
                                "storageKey": null
                              },
                              (v18/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanCostSummary",
                                "kind": "LinkedField",
                                "name": "costSummary",
                                "plural": false,
                                "selections": [
                                  (v21/*: any*/)
                                ],
                                "storageKey": null
                              },
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
                                          (v16/*: any*/),
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "score",
                                            "storageKey": null
                                          },
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
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      (v15/*: any*/)
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
                      (v14/*: any*/),
                      (v15/*: any*/)
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
            "args": (v17/*: any*/),
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
            "args": (v13/*: any*/),
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
                                      (v20/*: any*/),
                                      (v19/*: any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              (v22/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "runCount",
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
          },
          {
            "alias": "baseExperiment",
            "args": (v23/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v14/*: any*/),
              (v15/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  (v16/*: any*/)
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
        "condition": "isMetricsView",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "baseExperiment",
            "args": (v23/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": (v25/*: any*/),
            "storageKey": null
          },
          {
            "condition": "hasFirstCompareExperiment",
            "kind": "Condition",
            "passingValue": true,
            "selections": [
              {
                "alias": "firstCompareExperiment",
                "args": [
                  {
                    "kind": "Variable",
                    "name": "id",
                    "variableName": "firstCompareExperimentId"
                  }
                ],
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": (v25/*: any*/),
                "storageKey": null
              }
            ]
          },
          {
            "condition": "hasSecondCompareExperiment",
            "kind": "Condition",
            "passingValue": true,
            "selections": [
              {
                "alias": "secondCompareExperiment",
                "args": [
                  {
                    "kind": "Variable",
                    "name": "id",
                    "variableName": "secondCompareExperimentId"
                  }
                ],
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": (v25/*: any*/),
                "storageKey": null
              }
            ]
          },
          {
            "condition": "hasThirdCompareExperiment",
            "kind": "Condition",
            "passingValue": true,
            "selections": [
              {
                "alias": "thirdCompareExperiment",
                "args": [
                  {
                    "kind": "Variable",
                    "name": "id",
                    "variableName": "thirdCompareExperimentId"
                  }
                ],
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": (v25/*: any*/),
                "storageKey": null
              }
            ]
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "df9db8255c25bfb94942d7e6c34b80d4",
    "id": null,
    "metadata": {},
    "name": "experimentCompareLoaderQuery",
    "operationKind": "query",
    "text": "query experimentCompareLoaderQuery(\n  $datasetId: ID!\n  $baseExperimentId: ID!\n  $compareExperimentIds: [ID!]!\n  $firstCompareExperimentId: ID!\n  $secondCompareExperimentId: ID!\n  $thirdCompareExperimentId: ID!\n  $hasBaseExperiment: Boolean!\n  $hasFirstCompareExperiment: Boolean!\n  $hasSecondCompareExperiment: Boolean!\n  $hasThirdCompareExperiment: Boolean!\n  $isMetricsView: Boolean!\n) {\n  ...ExperimentCompareTable_comparisons_hJmED @include(if: $hasBaseExperiment)\n  ...ExperimentMultiSelector__data_3PEhJA\n  ...ExperimentCompareMetricsPage_experiments_CL9lE @include(if: $isMetricsView)\n}\n\nfragment ExperimentCompareMetricsPage_experiments_CL9lE on Query {\n  baseExperiment: node(id: $baseExperimentId) {\n    __typename\n    ... on Experiment {\n      id\n      averageRunLatencyMs\n      costSummary {\n        total {\n          tokens\n          cost\n        }\n        prompt {\n          tokens\n        }\n        completion {\n          tokens\n        }\n      }\n      annotationSummaries {\n        annotationName\n        meanScore\n      }\n    }\n    id\n  }\n  firstCompareExperiment: node(id: $firstCompareExperimentId) @include(if: $hasFirstCompareExperiment) {\n    __typename\n    ... on Experiment {\n      id\n      averageRunLatencyMs\n      costSummary {\n        total {\n          tokens\n          cost\n        }\n        prompt {\n          tokens\n        }\n        completion {\n          tokens\n        }\n      }\n      annotationSummaries {\n        annotationName\n        meanScore\n      }\n    }\n    id\n  }\n  secondCompareExperiment: node(id: $secondCompareExperimentId) @include(if: $hasSecondCompareExperiment) {\n    __typename\n    ... on Experiment {\n      id\n      averageRunLatencyMs\n      costSummary {\n        total {\n          tokens\n          cost\n        }\n        prompt {\n          tokens\n        }\n        completion {\n          tokens\n        }\n      }\n      annotationSummaries {\n        annotationName\n        meanScore\n      }\n    }\n    id\n  }\n  thirdCompareExperiment: node(id: $thirdCompareExperimentId) @include(if: $hasThirdCompareExperiment) {\n    __typename\n    ... on Experiment {\n      id\n      averageRunLatencyMs\n      costSummary {\n        total {\n          tokens\n          cost\n        }\n        prompt {\n          tokens\n        }\n        completion {\n          tokens\n        }\n      }\n      annotationSummaries {\n        annotationName\n        meanScore\n      }\n    }\n    id\n  }\n}\n\nfragment ExperimentCompareTable_comparisons_hJmED on Query {\n  compareExperiments(first: 50, baseExperimentId: $baseExperimentId, compareExperimentIds: $compareExperimentIds) {\n    edges {\n      comparison: node {\n        example {\n          id\n          revision {\n            input\n            referenceOutput: output\n          }\n        }\n        runComparisonItems {\n          experimentId\n          runs {\n            id\n            output\n            error\n            startTime\n            endTime\n            trace {\n              traceId\n              projectId\n              id\n            }\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n            }\n            annotations {\n              edges {\n                annotation: node {\n                  id\n                  name\n                  score\n                  label\n                  annotatorKind\n                  explanation\n                  trace {\n                    traceId\n                    projectId\n                    id\n                  }\n                }\n              }\n            }\n          }\n        }\n        id\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      experiments {\n        edges {\n          experiment: node {\n            id\n            name\n            sequenceNumber\n            metadata\n            project {\n              id\n            }\n            costSummary {\n              total {\n                cost\n                tokens\n              }\n            }\n            averageRunLatencyMs\n            runCount\n          }\n        }\n      }\n    }\n  }\n}\n\nfragment ExperimentMultiSelector__data_3PEhJA on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      id\n      name\n      experiments {\n        edges {\n          experiment: node {\n            id\n            name\n            sequenceNumber\n            createdAt\n          }\n        }\n      }\n    }\n  }\n  baseExperiment: node(id: $baseExperimentId) @include(if: $hasBaseExperiment) {\n    __typename\n    ... on Experiment {\n      id\n      name\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "963697d18a157906f6aa49ee2ae3e342";

export default node;
