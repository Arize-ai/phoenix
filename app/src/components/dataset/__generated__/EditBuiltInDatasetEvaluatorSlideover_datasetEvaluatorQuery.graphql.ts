/**
 * @generated SignedSource<<9c41520e5b7a01983f74ae1f8fa7dd92>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery$variables = {
  datasetEvaluatorId: string;
  datasetId: string;
};
export type EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery$data = {
  readonly dataset: {
    readonly datasetEvaluator?: {
      readonly description: string | null;
      readonly evaluator: {
        readonly description: string | null;
        readonly id: string;
        readonly inputSchema?: any | null;
        readonly kind: EvaluatorKind;
        readonly name: string;
        readonly outputConfigs?: ReadonlyArray<{
          readonly lowerBound?: number | null;
          readonly name?: string;
          readonly optimizationDirection?: OptimizationDirection;
          readonly upperBound?: number | null;
          readonly values?: ReadonlyArray<{
            readonly label: string;
            readonly score: number | null;
          }>;
        }>;
      };
      readonly id: string;
      readonly inputMapping: {
        readonly literalMapping: any;
        readonly pathMapping: any;
      };
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
      }>;
    };
    readonly id: string;
  };
};
export type EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery = {
  response: EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery$data;
  variables: EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetEvaluatorId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
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
v3 = [
  {
    "kind": "Variable",
    "name": "datasetEvaluatorId",
    "variableName": "datasetEvaluatorId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v7 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*: any*/),
    (v6/*: any*/),
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
v8 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*: any*/),
    (v6/*: any*/),
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
v9 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v7/*: any*/),
    (v8/*: any*/)
  ],
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluatorInputMapping",
  "kind": "LinkedField",
  "name": "inputMapping",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "literalMapping",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "pathMapping",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "inputSchema",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v13/*: any*/),
    (v7/*: any*/),
    (v8/*: any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        (v2/*: any*/)
      ],
      "type": "Node",
      "abstractKey": "__isNode"
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v9/*: any*/),
                  (v10/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v2/*: any*/),
                      (v4/*: any*/),
                      (v11/*: any*/),
                      (v5/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v12/*: any*/),
                          (v9/*: any*/)
                        ],
                        "type": "BuiltInEvaluator",
                        "abstractKey": null
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
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v13/*: any*/),
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v14/*: any*/),
                  (v10/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v13/*: any*/),
                      (v2/*: any*/),
                      (v4/*: any*/),
                      (v11/*: any*/),
                      (v5/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v12/*: any*/),
                          (v14/*: any*/)
                        ],
                        "type": "BuiltInEvaluator",
                        "abstractKey": null
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
    "cacheID": "c4937f3a2a62566a61f55f7539a1bb6c",
    "id": null,
    "metadata": {},
    "name": "EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery",
    "operationKind": "query",
    "text": "query EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery(\n  $datasetEvaluatorId: ID!\n  $datasetId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {\n        id\n        name\n        description\n        outputConfigs {\n          __typename\n          ... on CategoricalAnnotationConfig {\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on ContinuousAnnotationConfig {\n            name\n            optimizationDirection\n            lowerBound\n            upperBound\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n        inputMapping {\n          literalMapping\n          pathMapping\n        }\n        evaluator {\n          __typename\n          id\n          name\n          kind\n          description\n          ... on BuiltInEvaluator {\n            inputSchema\n            outputConfigs {\n              __typename\n              ... on CategoricalAnnotationConfig {\n                name\n                optimizationDirection\n                values {\n                  label\n                  score\n                }\n              }\n              ... on ContinuousAnnotationConfig {\n                name\n                optimizationDirection\n                lowerBound\n                upperBound\n              }\n              ... on Node {\n                __isNode: __typename\n                id\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7089cb8243d10fba90a9e571b44beec1";

export default node;
