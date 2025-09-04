/**
 * @generated SignedSource<<2a0ac53f937ee77a224780eb3aa59715>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentCompareTableQuery$variables = {
  after?: string | null;
  datasetId: string;
  datasetVersionId: string;
  experimentIds: ReadonlyArray<string>;
  filterCondition?: string | null;
  first?: number | null;
};
export type ExperimentCompareTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareTable_comparisons">;
};
export type ExperimentCompareTableQuery = {
  response: ExperimentCompareTableQuery$data;
  variables: ExperimentCompareTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetVersionId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentIds"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filterCondition"
  },
  {
    "defaultValue": 50,
    "kind": "LocalArgument",
    "name": "first"
  }
],
v1 = {
  "kind": "Variable",
  "name": "after",
  "variableName": "after"
},
v2 = {
  "kind": "Variable",
  "name": "datasetVersionId",
  "variableName": "datasetVersionId"
},
v3 = {
  "kind": "Variable",
  "name": "filterCondition",
  "variableName": "filterCondition"
},
v4 = {
  "kind": "Variable",
  "name": "first",
  "variableName": "first"
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = [
  (v1/*: any*/),
  (v2/*: any*/),
  (v3/*: any*/),
  (v4/*: any*/)
],
v8 = [
  {
    "kind": "Variable",
    "name": "filterIds",
    "variableName": "experimentIds"
  }
],
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "runCount",
  "storageKey": null
},
v10 = {
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
    (v6/*: any*/)
  ],
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokens",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentCompareTableQuery",
    "selections": [
      {
        "args": [
          (v1/*: any*/),
          {
            "kind": "Variable",
            "name": "datasetId",
            "variableName": "datasetId"
          },
          (v2/*: any*/),
          {
            "kind": "Variable",
            "name": "experimentIds",
            "variableName": "experimentIds"
          },
          (v3/*: any*/),
          (v4/*: any*/)
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExperimentCompareTableQuery",
    "selections": [
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
          (v5/*: any*/),
          (v6/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v7/*: any*/),
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
                          (v6/*: any*/),
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
                          },
                          {
                            "alias": null,
                            "args": (v8/*: any*/),
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
                                      (v6/*: any*/),
                                      (v9/*: any*/),
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
                                                  (v6/*: any*/),
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
                                                  (v10/*: any*/),
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
                                                          (v11/*: any*/),
                                                          (v12/*: any*/)
                                                        ],
                                                        "storageKey": null
                                                      }
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
                                                              (v6/*: any*/),
                                                              (v13/*: any*/),
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
                                                              (v10/*: any*/)
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
                        "concreteType": "DatasetExample",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v5/*: any*/),
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
                "args": (v7/*: any*/),
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
                "args": (v8/*: any*/),
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
                          (v6/*: any*/),
                          (v13/*: any*/),
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
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Project",
                            "kind": "LinkedField",
                            "name": "project",
                            "plural": false,
                            "selections": [
                              (v6/*: any*/)
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
                                  (v12/*: any*/),
                                  (v11/*: any*/)
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
                          (v9/*: any*/)
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
  "params": {
    "cacheID": "5adde239a0bf2eb50bfca1c0ae8c051b",
    "id": null,
    "metadata": {},
    "name": "ExperimentCompareTableQuery",
    "operationKind": "query",
    "text": "query ExperimentCompareTableQuery(\n  $after: String = null\n  $datasetId: ID!\n  $datasetVersionId: ID!\n  $experimentIds: [ID!]!\n  $filterCondition: String = null\n  $first: Int = 50\n) {\n  ...ExperimentCompareTable_comparisons_22hXcQ\n}\n\nfragment ExperimentCompareTable_comparisons_22hXcQ on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      examples(first: $first, after: $after, datasetVersionId: $datasetVersionId, filterCondition: $filterCondition) {\n        edges {\n          example: node {\n            id\n            revision {\n              input\n              referenceOutput: output\n            }\n            experiments(filterIds: $experimentIds) {\n              edges {\n                experiment: node {\n                  id\n                  runCount\n                  runs(first: 5) {\n                    edges {\n                      run: node {\n                        id\n                        output\n                        error\n                        startTime\n                        endTime\n                        trace {\n                          traceId\n                          projectId\n                          id\n                        }\n                        costSummary {\n                          total {\n                            tokens\n                            cost\n                          }\n                        }\n                        annotations {\n                          edges {\n                            annotation: node {\n                              id\n                              name\n                              score\n                              label\n                              annotatorKind\n                              explanation\n                              trace {\n                                traceId\n                                projectId\n                                id\n                              }\n                            }\n                          }\n                        }\n                      }\n                    }\n                  }\n                }\n              }\n            }\n          }\n          cursor\n          node {\n            __typename\n            id\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n      experiments(filterIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            name\n            sequenceNumber\n            metadata\n            project {\n              id\n            }\n            costSummary {\n              total {\n                cost\n                tokens\n              }\n            }\n            averageRunLatencyMs\n            runCount\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ad202624c249dead690a132756796c97";

export default node;
