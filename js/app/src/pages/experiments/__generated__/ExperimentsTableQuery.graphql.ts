/**
 * @generated SignedSource<<0c26168e74a9e9f7b3ed12296e094c6e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentMetadataFilter = {
  path: ReadonlyArray<string>;
  value: any;
};
export type ExperimentsTableQuery$variables = {
  after?: string | null;
  filterCondition?: string | null;
  first?: number | null;
  id: string;
  metadataFilters?: ReadonlyArray<ExperimentMetadataFilter> | null;
};
export type ExperimentsTableQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"ExperimentsTableFragment">;
  };
};
export type ExperimentsTableQuery = {
  response: ExperimentsTableQuery$data;
  variables: ExperimentsTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "after"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterCondition"
},
v2 = {
  "defaultValue": 100,
  "kind": "LocalArgument",
  "name": "first"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "metadataFilters"
},
v5 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v6 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  {
    "kind": "Variable",
    "name": "filterCondition",
    "variableName": "filterCondition"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  },
  {
    "kind": "Variable",
    "name": "metadataFilters",
    "variableName": "metadataFilters"
  }
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationName",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "runCount",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "averageRunLatencyMs",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "errorRate",
  "storageKey": null
},
v13 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "tokens",
    "storageKey": null
  },
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
  "concreteType": "CostBreakdown",
  "kind": "LinkedField",
  "name": "total",
  "plural": false,
  "selections": (v13/*:: as any*/),
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "meanScore",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
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
  "name": "lowerBound",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v20 = [
  (v8/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/),
      (v4/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentsTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v5/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": (v6/*:: as any*/),
            "kind": "FragmentSpread",
            "name": "ExperimentsTableFragment"
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
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v4/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ExperimentsTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v5/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*:: as any*/),
          (v8/*:: as any*/),
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
                  (v9/*:: as any*/),
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
                "args": null,
                "concreteType": "Experiment",
                "kind": "LinkedField",
                "name": "baselineExperiment",
                "plural": false,
                "selections": [
                  (v8/*:: as any*/),
                  (v10/*:: as any*/),
                  (v11/*:: as any*/),
                  (v12/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SpanCostSummary",
                    "kind": "LinkedField",
                    "name": "costSummary",
                    "plural": false,
                    "selections": [
                      (v14/*:: as any*/)
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
                      (v9/*:: as any*/),
                      (v15/*:: as any*/)
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
                          (v16/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "outputConfigs",
                            "plural": true,
                            "selections": [
                              (v7/*:: as any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v16/*:: as any*/),
                                  (v17/*:: as any*/),
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
                                  (v16/*:: as any*/),
                                  (v17/*:: as any*/),
                                  (v18/*:: as any*/),
                                  (v19/*:: as any*/)
                                ],
                                "type": "ContinuousAnnotationConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v16/*:: as any*/),
                                  (v17/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "threshold",
                                    "storageKey": null
                                  },
                                  (v18/*:: as any*/),
                                  (v19/*:: as any*/)
                                ],
                                "type": "FreeformAnnotationConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": (v20/*:: as any*/),
                                "type": "Node",
                                "abstractKey": "__isNode"
                              }
                            ],
                            "storageKey": null
                          },
                          (v8/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "datasetEvaluators(first:100)"
              },
              {
                "alias": null,
                "args": (v6/*:: as any*/),
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
                          (v8/*:: as any*/),
                          (v16/*:: as any*/),
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
                            "name": "description",
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
                            "name": "createdAt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "metadata",
                            "storageKey": null
                          },
                          (v12/*:: as any*/),
                          (v10/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "expectedRunCount",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "repetitions",
                            "storageKey": null
                          },
                          (v11/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Project",
                            "kind": "LinkedField",
                            "name": "project",
                            "plural": false,
                            "selections": (v20/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DatasetSplitConnection",
                            "kind": "LinkedField",
                            "name": "datasetSplits",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "DatasetSplitEdge",
                                "kind": "LinkedField",
                                "name": "edges",
                                "plural": true,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "DatasetSplit",
                                    "kind": "LinkedField",
                                    "name": "node",
                                    "plural": false,
                                    "selections": [
                                      (v8/*:: as any*/),
                                      (v16/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "color",
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
                            "concreteType": "SpanCostSummary",
                            "kind": "LinkedField",
                            "name": "costSummary",
                            "plural": false,
                            "selections": [
                              (v14/*:: as any*/),
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
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentAnnotationSummary",
                            "kind": "LinkedField",
                            "name": "annotationSummaries",
                            "plural": true,
                            "selections": [
                              (v9/*:: as any*/),
                              (v15/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "count",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "errorCount",
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "User",
                            "kind": "LinkedField",
                            "name": "user",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "username",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "profilePictureUrl",
                                "storageKey": null
                              },
                              (v8/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentJob",
                            "kind": "LinkedField",
                            "name": "job",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "status",
                                "storageKey": null
                              },
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
                        "name": "cursor",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Experiment",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v7/*:: as any*/),
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
                  "filterCondition",
                  "metadataFilters"
                ],
                "handle": "connection",
                "key": "ExperimentsTable_experiments",
                "kind": "LinkedHandle",
                "name": "experiments"
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
    "cacheID": "33d427e5dc8d476b264fc1ce75da357b",
    "id": null,
    "metadata": {},
    "name": "ExperimentsTableQuery",
    "operationKind": "query",
    "text": "query ExperimentsTableQuery(\n  $after: String = null\n  $filterCondition: String = null\n  $first: Int = 100\n  $metadataFilters: [ExperimentMetadataFilter!] = null\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...ExperimentsTableFragment_4tVFte\n    id\n  }\n}\n\nfragment ExperimentsTableFragment_4tVFte on Dataset {\n  id\n  experimentAnnotationSummaries {\n    annotationName\n    minScore\n    maxScore\n  }\n  baselineExperiment {\n    id\n    runCount\n    averageRunLatencyMs\n    errorRate\n    costSummary {\n      total {\n        tokens\n        cost\n      }\n    }\n    annotationSummaries {\n      annotationName\n      meanScore\n    }\n  }\n  datasetEvaluators(first: 100) {\n    edges {\n      node {\n        name\n        outputConfigs {\n          __typename\n          ... on CategoricalAnnotationConfig {\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on ContinuousAnnotationConfig {\n            name\n            optimizationDirection\n            lowerBound\n            upperBound\n          }\n          ... on FreeformAnnotationConfig {\n            name\n            optimizationDirection\n            threshold\n            lowerBound\n            upperBound\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n        id\n      }\n    }\n  }\n  experiments(first: $first, after: $after, filterCondition: $filterCondition, metadataFilters: $metadataFilters) {\n    edges {\n      experiment: node {\n        id\n        name\n        sequenceNumber\n        description\n        isBaseline\n        createdAt\n        metadata\n        errorRate\n        runCount\n        expectedRunCount\n        repetitions\n        averageRunLatencyMs\n        project {\n          id\n        }\n        datasetSplits {\n          edges {\n            node {\n              id\n              name\n              color\n            }\n          }\n        }\n        costSummary {\n          total {\n            tokens\n            cost\n          }\n          prompt {\n            tokens\n            cost\n          }\n          completion {\n            tokens\n            cost\n          }\n        }\n        annotationSummaries {\n          annotationName\n          meanScore\n          count\n          errorCount\n        }\n        user {\n          username\n          profilePictureUrl\n          id\n        }\n        job {\n          status\n          id\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5f644a748c415888d79184a260ca0028";

export default node;
