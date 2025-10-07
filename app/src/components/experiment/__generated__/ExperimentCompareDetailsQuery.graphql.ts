/**
 * @generated SignedSource<<81d0c0fa8339d9ae74ea3c349c68d583>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentCompareDetailsQuery$variables = {
  datasetExampleId: string;
  datasetId: string;
  datasetVersionId: string;
  experimentIds: ReadonlyArray<string>;
};
export type ExperimentCompareDetailsQuery$data = {
  readonly dataset: {
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
                readonly name: string;
                readonly score: number | null;
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
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = {
  "kind": "InlineFragment",
  "selections": [
    {
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
    {
      "alias": null,
      "args": [
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
                (v5/*: any*/),
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
                  "name": "latencyMs",
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
                            (v5/*: any*/),
                            (v6/*: any*/),
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
v8 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v9 = {
  "kind": "InlineFragment",
  "selections": [
    {
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
                (v5/*: any*/),
                (v6/*: any*/),
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
    {
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
    }
  ],
  "type": "Dataset",
  "abstractKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
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
          (v7/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "dataset",
        "args": (v8/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v9/*: any*/)
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
          (v10/*: any*/),
          (v7/*: any*/),
          (v5/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "dataset",
        "args": (v8/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v10/*: any*/),
          (v9/*: any*/),
          (v5/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "bb0352aac53c424cbd68b7c6b96ee140",
    "id": null,
    "metadata": {},
    "name": "ExperimentCompareDetailsQuery",
    "operationKind": "query",
    "text": "query ExperimentCompareDetailsQuery(\n  $datasetId: ID!\n  $datasetExampleId: ID!\n  $datasetVersionId: ID!\n  $experimentIds: [ID!]!\n) {\n  example: node(id: $datasetExampleId) {\n    __typename\n    ... on DatasetExample {\n      revision(datasetVersionId: $datasetVersionId) {\n        input\n        referenceOutput: output\n      }\n      experimentRuns(experimentIds: $experimentIds, first: 120) {\n        edges {\n          run: node {\n            id\n            repetitionNumber\n            latencyMs\n            experimentId\n            output\n            error\n            costSummary {\n              total {\n                cost\n                tokens\n              }\n            }\n            annotations {\n              edges {\n                annotation: node {\n                  id\n                  name\n                  label\n                  score\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      experiments(filterIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            name\n            repetitions\n          }\n        }\n      }\n      experimentAnnotationSummaries {\n        annotationName\n        minScore\n        maxScore\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "ee5ee5ca5b7a7118c821054d5ed88af5";

export default node;
