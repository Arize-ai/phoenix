/**
 * @generated SignedSource<<fa9a2d1f6860af34591f3a96303def4b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "DECISION" | "LLM";
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
          readonly threshold: number | null;
          readonly upperBound: number | null;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        }>;
      };
      readonly id: string;
      readonly inputMapping: {
        readonly literalMapping: any;
        readonly pathMapping: any;
      };
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
        readonly threshold: number | null;
        readonly upperBound: number | null;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
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
  "name": "__typename",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v8 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v7/*:: as any*/),
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
v9 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v7/*:: as any*/),
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "threshold",
      "storageKey": null
    }
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v6/*:: as any*/),
    (v8/*:: as any*/),
    (v9/*:: as any*/)
  ],
  "storageKey": null
},
v11 = {
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
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "inputSchema",
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
    (v6/*:: as any*/),
    (v8/*:: as any*/),
    (v9/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        (v2/*:: as any*/)
      ],
      "type": "Node",
      "abstractKey": "__isNode"
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v10/*:: as any*/),
                  (v11/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v2/*:: as any*/),
                      (v4/*:: as any*/),
                      (v12/*:: as any*/),
                      (v5/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v13/*:: as any*/),
                          (v10/*:: as any*/)
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*:: as any*/),
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v14/*:: as any*/),
                  (v11/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v6/*:: as any*/),
                      (v2/*:: as any*/),
                      (v4/*:: as any*/),
                      (v12/*:: as any*/),
                      (v5/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v13/*:: as any*/),
                          (v14/*:: as any*/)
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
    "cacheID": "c0810e1265ab2f094a24815ed2eef37e",
    "id": null,
    "metadata": {},
    "name": "EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery",
    "operationKind": "query",
    "text": "query EditBuiltInDatasetEvaluatorSlideover_datasetEvaluatorQuery(\n  $datasetEvaluatorId: ID!\n  $datasetId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {\n        id\n        name\n        description\n        outputConfigs {\n          __typename\n          ... on CategoricalAnnotationConfig {\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on ContinuousAnnotationConfig {\n            name\n            optimizationDirection\n            lowerBound\n            upperBound\n            threshold\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n        inputMapping {\n          literalMapping\n          pathMapping\n        }\n        evaluator {\n          __typename\n          id\n          name\n          kind\n          description\n          ... on BuiltInEvaluator {\n            inputSchema\n            outputConfigs {\n              __typename\n              ... on CategoricalAnnotationConfig {\n                name\n                optimizationDirection\n                values {\n                  label\n                  score\n                }\n              }\n              ... on ContinuousAnnotationConfig {\n                name\n                optimizationDirection\n                lowerBound\n                upperBound\n                threshold\n              }\n              ... on Node {\n                __isNode: __typename\n                id\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8a98131a89c1afd47d1193e14216fafd";

export default node;
