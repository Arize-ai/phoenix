/**
 * @generated SignedSource<<6340719c7f1bd76ff7297df12fb6ffac>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type ExperimentCompareDetailsQuery$variables = {
  datasetExampleId: string;
  datasetId: string;
  datasetVersionId: string;
  experimentIds: ReadonlyArray<string>;
};
export type ExperimentCompareDetailsQuery$data = {
  readonly dataset: {
    readonly datasetEvaluators?: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly name: string;
          readonly outputConfigs: ReadonlyArray<{
            readonly lowerBound?: number | null;
            readonly name?: string;
            readonly optimizationDirection?: OptimizationDirection;
            readonly upperBound?: number | null;
            readonly values?: ReadonlyArray<{
              readonly label: string;
              readonly score: number | null;
            }>;
          }> | null;
        };
      }>;
    };
    readonly experimentAnnotationSummaries?: ReadonlyArray<{
      readonly annotationName: string;
      readonly maxScore: number | null;
      readonly minScore: number | null;
    }>;
    readonly experiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly id: string;
          readonly name: string;
          readonly repetitions: number;
        };
      }>;
    };
  };
  readonly example: {
    readonly experimentRuns?: {
      readonly edges: ReadonlyArray<{
        readonly run: {
          readonly annotations: {
            readonly edges: ReadonlyArray<{
              readonly annotation: {
                readonly id: string;
                readonly label: string | null;
                readonly metadata: any;
                readonly name: string;
                readonly score: number | null;
                readonly trace: {
                  readonly projectId: string;
                  readonly traceId: string;
                } | null;
              };
            }>;
          };
          readonly costSummary: {
            readonly total: {
              readonly cost: number | null;
              readonly tokens: number | null;
            };
          };
          readonly error: string | null;
          readonly experimentId: string;
          readonly id: string;
          readonly latencyMs: number;
          readonly output: any | null;
          readonly repetitionNumber: number;
          readonly trace: {
            readonly projectId: string;
            readonly traceId: string;
          } | null;
        };
      }>;
    };
    readonly revision?: {
      readonly input: any;
      readonly referenceOutput: any;
    };
  };
};
export type ExperimentCompareDetailsQuery = {
  response: ExperimentCompareDetailsQuery$data;
  variables: ExperimentCompareDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetExampleId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetVersionId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "experimentIds"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetExampleId"
  }
],
v5 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "datasetVersionId",
      "variableName": "datasetVersionId"
    }
  ],
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
v6 = [
  {
    "kind": "Variable",
    "name": "experimentIds",
    "variableName": "experimentIds"
  },
  {
    "kind": "Literal",
    "name": "first",
    "value": 120
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
  "name": "repetitionNumber",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "experimentId",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "error",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectId",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "concreteType": "Trace",
  "kind": "LinkedField",
  "name": "trace",
  "plural": false,
  "selections": [
    (v13/*: any*/),
    (v14/*: any*/)
  ],
  "storageKey": null
},
v16 = {
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
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "cost",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "tokens",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
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
  "name": "score",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v21 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v22 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "filterIds",
      "variableName": "experimentIds"
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
            (v7/*: any*/),
            (v17/*: any*/),
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
},
v23 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetExperimentAnnotationSummary",
  "kind": "LinkedField",
  "name": "experimentAnnotationSummaries",
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
v24 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
],
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v26 = {
  "kind": "InlineFragment",
  "selections": [
    (v17/*: any*/),
    (v25/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "CategoricalAnnotationValue",
      "kind": "LinkedField",
      "name": "values",
      "plural": true,
      "selections": [
        (v18/*: any*/),
        (v19/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "CategoricalAnnotationConfig",
  "abstractKey": null
},
v27 = {
  "kind": "InlineFragment",
  "selections": [
    (v17/*: any*/),
    (v25/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lowerBound",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "upperBound",
      "storageKey": null
    }
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
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
    (v13/*: any*/),
    (v14/*: any*/),
    (v7/*: any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentCompareDetailsQuery",
    "selections": [
      {
        "alias": "example",
        "args": (v4/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*: any*/),
              {
                "alias": null,
                "args": (v6/*: any*/),
                "concreteType": "ExperimentRunConnection",
                "kind": "LinkedField",
                "name": "experimentRuns",
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
                          (v7/*: any*/),
                          (v8/*: any*/),
                          (v9/*: any*/),
                          (v10/*: any*/),
                          (v11/*: any*/),
                          (v12/*: any*/),
                          (v15/*: any*/),
                          (v16/*: any*/),
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
                                      (v7/*: any*/),
                                      (v17/*: any*/),
                                      (v18/*: any*/),
                                      (v19/*: any*/),
                                      (v20/*: any*/),
                                      (v15/*: any*/)
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
                "storageKey": null
              }
            ],
            "type": "DatasetExample",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": "dataset",
        "args": (v21/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v22/*: any*/),
              (v23/*: any*/),
              {
                "alias": null,
                "args": (v24/*: any*/),
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
                          (v17/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "outputConfigs",
                            "plural": true,
                            "selections": [
                              (v26/*: any*/),
                              (v27/*: any*/)
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
                "storageKey": "datasetEvaluators(first:100)"
              }
            ],
            "type": "Dataset",
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
      (v1/*: any*/),
      (v0/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Operation",
    "name": "ExperimentCompareDetailsQuery",
    "selections": [
      {
        "alias": "example",
        "args": (v4/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v28/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*: any*/),
              {
                "alias": null,
                "args": (v6/*: any*/),
                "concreteType": "ExperimentRunConnection",
                "kind": "LinkedField",
                "name": "experimentRuns",
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
                          (v7/*: any*/),
                          (v8/*: any*/),
                          (v9/*: any*/),
                          (v10/*: any*/),
                          (v11/*: any*/),
                          (v12/*: any*/),
                          (v29/*: any*/),
                          (v16/*: any*/),
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
                                      (v7/*: any*/),
                                      (v17/*: any*/),
                                      (v18/*: any*/),
                                      (v19/*: any*/),
                                      (v20/*: any*/),
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
                "storageKey": null
              }
            ],
            "type": "DatasetExample",
            "abstractKey": null
          },
          (v7/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "dataset",
        "args": (v21/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v28/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v22/*: any*/),
              (v23/*: any*/),
              {
                "alias": null,
                "args": (v24/*: any*/),
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
                          (v17/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "outputConfigs",
                            "plural": true,
                            "selections": [
                              (v28/*: any*/),
                              (v26/*: any*/),
                              (v27/*: any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v7/*: any*/)
                                ],
                                "type": "Node",
                                "abstractKey": "__isNode"
                              }
                            ],
                            "storageKey": null
                          },
                          (v7/*: any*/)
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
          },
          (v7/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "9db9b824c30cbf7add6118a2763f8c1b",
    "id": null,
    "metadata": {},
    "name": "ExperimentCompareDetailsQuery",
    "operationKind": "query",
    "text": "query ExperimentCompareDetailsQuery(\n  $datasetId: ID!\n  $datasetExampleId: ID!\n  $datasetVersionId: ID!\n  $experimentIds: [ID!]!\n) {\n  example: node(id: $datasetExampleId) {\n    __typename\n    ... on DatasetExample {\n      revision(datasetVersionId: $datasetVersionId) {\n        input\n        referenceOutput: output\n      }\n      experimentRuns(experimentIds: $experimentIds, first: 120) {\n        edges {\n          run: node {\n            id\n            repetitionNumber\n            latencyMs\n            experimentId\n            output\n            error\n            trace {\n              traceId\n              projectId\n              id\n            }\n            costSummary {\n              total {\n                cost\n                tokens\n              }\n            }\n            annotations {\n              edges {\n                annotation: node {\n                  id\n                  name\n                  label\n                  score\n                  metadata\n                  trace {\n                    traceId\n                    projectId\n                    id\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      experiments(filterIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            name\n            repetitions\n          }\n        }\n      }\n      experimentAnnotationSummaries {\n        annotationName\n        minScore\n        maxScore\n      }\n      datasetEvaluators(first: 100) {\n        edges {\n          node {\n            name\n            outputConfigs {\n              __typename\n              ... on CategoricalAnnotationConfig {\n                name\n                optimizationDirection\n                values {\n                  label\n                  score\n                }\n              }\n              ... on ContinuousAnnotationConfig {\n                name\n                optimizationDirection\n                lowerBound\n                upperBound\n              }\n              ... on Node {\n                __isNode: __typename\n                id\n              }\n            }\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "b02872ee36b62f089986aa3afbe64bc0";

export default node;
