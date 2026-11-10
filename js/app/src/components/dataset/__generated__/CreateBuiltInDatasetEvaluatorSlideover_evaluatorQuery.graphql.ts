/**
 * @generated SignedSource<<5d5c51dc248c3a5cc2871c01775c35a3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
export type EvaluatorKind = "BUILTIN" | "CODE" | "DECISION" | "LLM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery$variables = {
  evaluatorId: string;
};
export type CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery$data = {
  readonly evaluator: {
    readonly description?: string | null;
    readonly id: string;
    readonly inputSchema?: any | null;
    readonly isBuiltin?: boolean;
    readonly kind?: EvaluatorKind;
    readonly name?: string;
    readonly outputConfigs?: ReadonlyArray<{
      readonly __typename: "CategoricalAnnotationConfig";
      readonly annotationType: AnnotationType;
      readonly name: string;
      readonly optimizationDirection: OptimizationDirection;
      readonly values: ReadonlyArray<{
        readonly label: string;
        readonly score: number | null;
      }>;
    } | {
      readonly __typename: "ContinuousAnnotationConfig";
      readonly annotationType: AnnotationType;
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
};
export type CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery = {
  response: CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery$data;
  variables: CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "evaluatorId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "evaluatorId"
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
v4 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "kind",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "isBuiltin",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "description",
      "storageKey": null
    }
  ],
  "type": "Evaluator",
  "abstractKey": "__isEvaluator"
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "inputSchema",
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
  "name": "annotationType",
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
    (v7/*:: as any*/),
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
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/),
    (v7/*:: as any*/),
    (v8/*:: as any*/),
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "evaluator",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v4/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "outputConfigs",
                "plural": true,
                "selections": [
                  (v6/*:: as any*/),
                  (v9/*:: as any*/),
                  (v10/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "BuiltInEvaluator",
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
    "name": "CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "evaluator",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*:: as any*/),
          (v2/*:: as any*/),
          (v4/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "outputConfigs",
                "plural": true,
                "selections": [
                  (v6/*:: as any*/),
                  (v9/*:: as any*/),
                  (v10/*:: as any*/),
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
              }
            ],
            "type": "BuiltInEvaluator",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2b6c68361c33e4f1e5173b29e46da786",
    "id": null,
    "metadata": {},
    "name": "CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery",
    "operationKind": "query",
    "text": "query CreateBuiltInDatasetEvaluatorSlideover_evaluatorQuery(\n  $evaluatorId: ID!\n) {\n  evaluator: node(id: $evaluatorId) {\n    __typename\n    id\n    ... on Evaluator {\n      __isEvaluator: __typename\n      name\n      kind\n      isBuiltin\n      description\n    }\n    ... on BuiltInEvaluator {\n      inputSchema\n      outputConfigs {\n        __typename\n        ... on CategoricalAnnotationConfig {\n          name\n          annotationType\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          name\n          annotationType\n          optimizationDirection\n          lowerBound\n          upperBound\n          threshold\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d65448c25733f9b4b3f29ac478a6bd76";

export default node;
