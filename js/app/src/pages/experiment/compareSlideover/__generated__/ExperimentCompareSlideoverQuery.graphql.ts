/**
 * @generated SignedSource<<8c8ad223758fe695d7f699fa184df2e9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type ExperimentCompareSlideoverQuery$variables = {
  datasetId: string;
  experimentIds: ReadonlyArray<string>;
};
export type ExperimentCompareSlideoverQuery$data = {
  readonly dataset: {
    readonly datasetEvaluators?: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly name: string;
          readonly outputConfigs: ReadonlyArray<{
            readonly __typename: "CategoricalAnnotationConfig";
            readonly name: string;
            readonly optimizationDirection: OptimizationDirection;
            readonly values: ReadonlyArray<{
              readonly label: string;
              readonly score: number | null;
            }>;
          } | {
            readonly __typename: "ContinuousAnnotationConfig";
            readonly lowerBound: number | null;
            readonly name: string;
            readonly optimizationDirection: OptimizationDirection;
            readonly upperBound: number | null;
          } | {
            readonly __typename: "FreeformAnnotationConfig";
            readonly lowerBound: number | null;
            readonly name: string;
            readonly optimizationDirection: OptimizationDirection;
            readonly threshold: number | null;
            readonly upperBound: number | null;
          } | {
            // This will never be '%other', but we need some
            // value in case none of the concrete values match.
            readonly __typename: "%other";
          }>;
        };
      }>;
    };
    readonly experiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly annotationSummaries: ReadonlyArray<{
            readonly annotationName: string;
            readonly maxScore: number | null;
            readonly minScore: number | null;
          }>;
          readonly datasetVersion: {
            readonly id: string;
          };
          readonly id: string;
          readonly metadata: any;
          readonly name: string;
          readonly repetitions: number;
          readonly sequenceNumber: number;
        };
      }>;
    };
  };
};
export type ExperimentCompareSlideoverQuery = {
  response: ExperimentCompareSlideoverQuery$data;
  variables: ExperimentCompareSlideoverQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentIds"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = [
  (v2/*:: as any*/)
],
v5 = {
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
            (v2/*:: as any*/),
            (v3/*:: as any*/),
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
              "name": "repetitions",
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
              "concreteType": "DatasetVersion",
              "kind": "LinkedField",
              "name": "datasetVersion",
              "plural": false,
              "selections": (v4/*:: as any*/),
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
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v6 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
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
  "name": "optimizationDirection",
  "storageKey": null
},
v9 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/),
    (v8/*:: as any*/),
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
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v12 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/),
    (v8/*:: as any*/),
    (v10/*:: as any*/),
    (v11/*:: as any*/)
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v13 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/),
    (v8/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "threshold",
      "storageKey": null
    },
    (v10/*:: as any*/),
    (v11/*:: as any*/)
  ],
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentCompareSlideoverQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*:: as any*/),
              {
                "alias": null,
                "args": (v6/*:: as any*/),
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
                          (v3/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "outputConfigs",
                            "plural": true,
                            "selections": [
                              (v7/*:: as any*/),
                              (v9/*:: as any*/),
                              (v12/*:: as any*/),
                              (v13/*:: as any*/)
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ExperimentCompareSlideoverQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*:: as any*/),
              {
                "alias": null,
                "args": (v6/*:: as any*/),
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
                          (v3/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "outputConfigs",
                            "plural": true,
                            "selections": [
                              (v7/*:: as any*/),
                              (v9/*:: as any*/),
                              (v12/*:: as any*/),
                              (v13/*:: as any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": (v4/*:: as any*/),
                                "type": "Node",
                                "abstractKey": "__isNode"
                              }
                            ],
                            "storageKey": null
                          },
                          (v2/*:: as any*/)
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
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "448eb5c2c2b26dfc3985ab6296403602",
    "id": null,
    "metadata": {},
    "name": "ExperimentCompareSlideoverQuery",
    "operationKind": "query",
    "text": "query ExperimentCompareSlideoverQuery(\n  $datasetId: ID!\n  $experimentIds: [ID!]!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      experiments(filterIds: $experimentIds, includeEphemeral: true) {\n        edges {\n          experiment: node {\n            id\n            name\n            sequenceNumber\n            repetitions\n            metadata\n            datasetVersion {\n              id\n            }\n            annotationSummaries {\n              annotationName\n              minScore\n              maxScore\n            }\n          }\n        }\n      }\n      datasetEvaluators(first: 100) {\n        edges {\n          node {\n            name\n            outputConfigs {\n              __typename\n              ... on CategoricalAnnotationConfig {\n                name\n                optimizationDirection\n                values {\n                  label\n                  score\n                }\n              }\n              ... on ContinuousAnnotationConfig {\n                name\n                optimizationDirection\n                lowerBound\n                upperBound\n              }\n              ... on FreeformAnnotationConfig {\n                name\n                optimizationDirection\n                threshold\n                lowerBound\n                upperBound\n              }\n              ... on Node {\n                __isNode: __typename\n                id\n              }\n            }\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "5242fede6d4bce908113d9ad7585b3f2";

export default node;
