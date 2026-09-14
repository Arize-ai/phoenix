/**
 * @generated SignedSource<<7398745af7581c1ac3f1387ef90227fd>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type projectEvaluatorCompareLoaderQuery$variables = {
  evaluatorAId: string;
  evaluatorBId: string;
  projectId: string;
};
export type projectEvaluatorCompareLoaderQuery$data = {
  readonly evaluatorA: {
    readonly __typename: "ProjectEvaluator";
    readonly evaluationTarget: EvaluationTarget;
    readonly evaluator: {
      readonly outputConfigs: ReadonlyArray<{
        readonly annotationType?: AnnotationType;
        readonly lowerBound?: number | null;
        readonly name?: string;
        readonly optimizationDirection?: OptimizationDirection;
        readonly threshold?: number | null;
        readonly upperBound?: number | null;
        readonly values?: ReadonlyArray<{
          readonly label: string;
          readonly score: number | null;
        }>;
      }>;
    };
    readonly id: string;
    readonly name: string;
    readonly project: {
      readonly id: string;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly evaluatorB: {
    readonly __typename: "ProjectEvaluator";
    readonly evaluationTarget: EvaluationTarget;
    readonly evaluator: {
      readonly outputConfigs: ReadonlyArray<{
        readonly annotationType?: AnnotationType;
        readonly lowerBound?: number | null;
        readonly name?: string;
        readonly optimizationDirection?: OptimizationDirection;
        readonly threshold?: number | null;
        readonly upperBound?: number | null;
        readonly values?: ReadonlyArray<{
          readonly label: string;
          readonly score: number | null;
        }>;
      }>;
    };
    readonly id: string;
    readonly name: string;
    readonly project: {
      readonly id: string;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly project: {
    readonly __typename: "Project";
    readonly evaluators: {
      readonly edges: ReadonlyArray<{
        readonly evaluator: {
          readonly evaluationTarget: EvaluationTarget;
          readonly id: string;
          readonly name: string;
        };
      }>;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type projectEvaluatorCompareLoaderQuery = {
  response: projectEvaluatorCompareLoaderQuery$data;
  variables: projectEvaluatorCompareLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "evaluatorAId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "evaluatorBId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluationTarget",
  "storageKey": null
},
v8 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 100
        }
      ],
      "concreteType": "ProjectEvaluatorConnection",
      "kind": "LinkedField",
      "name": "evaluators",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ProjectEvaluatorEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "evaluator",
              "args": null,
              "concreteType": "ProjectEvaluator",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v5/*:: as any*/),
                (v6/*:: as any*/),
                (v7/*:: as any*/)
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "evaluators(first:100)"
    }
  ],
  "type": "Project",
  "abstractKey": null
},
v9 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "evaluatorAId"
  }
],
v10 = {
  "kind": "InlineFragment",
  "selections": [
    (v6/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "annotationType",
      "storageKey": null
    }
  ],
  "type": "AnnotationConfigBase",
  "abstractKey": "__isAnnotationConfigBase"
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v12 = {
  "kind": "InlineFragment",
  "selections": [
    (v11/*:: as any*/),
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
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v15 = {
  "kind": "InlineFragment",
  "selections": [
    (v11/*:: as any*/),
    (v13/*:: as any*/),
    (v14/*:: as any*/)
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v16 = {
  "kind": "InlineFragment",
  "selections": [
    (v11/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "threshold",
      "storageKey": null
    },
    (v13/*:: as any*/),
    (v14/*:: as any*/)
  ],
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
},
v17 = [
  (v5/*:: as any*/)
],
v18 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": (v17/*:: as any*/),
  "storageKey": null
},
v19 = [
  (v4/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v5/*:: as any*/),
      (v6/*:: as any*/),
      (v7/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": null,
        "kind": "LinkedField",
        "name": "evaluator",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "outputConfigs",
            "plural": true,
            "selections": [
              (v10/*:: as any*/),
              (v12/*:: as any*/),
              (v15/*:: as any*/),
              (v16/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      (v18/*:: as any*/)
    ],
    "type": "ProjectEvaluator",
    "abstractKey": null
  }
],
v20 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "evaluatorBId"
  }
],
v21 = [
  (v4/*:: as any*/),
  (v5/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v6/*:: as any*/),
      (v7/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": null,
        "kind": "LinkedField",
        "name": "evaluator",
        "plural": false,
        "selections": [
          (v4/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "outputConfigs",
            "plural": true,
            "selections": [
              (v4/*:: as any*/),
              (v10/*:: as any*/),
              (v12/*:: as any*/),
              (v15/*:: as any*/),
              (v16/*:: as any*/),
              {
                "kind": "InlineFragment",
                "selections": (v17/*:: as any*/),
                "type": "Node",
                "abstractKey": "__isNode"
              }
            ],
            "storageKey": null
          },
          (v5/*:: as any*/)
        ],
        "storageKey": null
      },
      (v18/*:: as any*/)
    ],
    "type": "ProjectEvaluator",
    "abstractKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "projectEvaluatorCompareLoaderQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*:: as any*/),
          (v8/*:: as any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "evaluatorA",
        "args": (v9/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v19/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": "evaluatorB",
        "args": (v20/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v19/*:: as any*/),
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*:: as any*/),
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "projectEvaluatorCompareLoaderQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*:: as any*/),
          (v8/*:: as any*/),
          (v5/*:: as any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "evaluatorA",
        "args": (v9/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v21/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": "evaluatorB",
        "args": (v20/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v21/*:: as any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "890114946b41c1a39385c9d5d98bca3c",
    "id": null,
    "metadata": {},
    "name": "projectEvaluatorCompareLoaderQuery",
    "operationKind": "query",
    "text": "query projectEvaluatorCompareLoaderQuery(\n  $projectId: ID!\n  $evaluatorAId: ID!\n  $evaluatorBId: ID!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluators(first: 100) {\n        edges {\n          evaluator: node {\n            id\n            name\n            evaluationTarget\n          }\n        }\n      }\n    }\n    id\n  }\n  evaluatorA: node(id: $evaluatorAId) {\n    __typename\n    ... on ProjectEvaluator {\n      id\n      name\n      evaluationTarget\n      evaluator {\n        __typename\n        outputConfigs {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            name\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on ContinuousAnnotationConfig {\n            optimizationDirection\n            lowerBound\n            upperBound\n          }\n          ... on FreeformAnnotationConfig {\n            optimizationDirection\n            threshold\n            lowerBound\n            upperBound\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n        id\n      }\n      project {\n        id\n      }\n    }\n    id\n  }\n  evaluatorB: node(id: $evaluatorBId) {\n    __typename\n    ... on ProjectEvaluator {\n      id\n      name\n      evaluationTarget\n      evaluator {\n        __typename\n        outputConfigs {\n          __typename\n          ... on AnnotationConfigBase {\n            __isAnnotationConfigBase: __typename\n            name\n            annotationType\n          }\n          ... on CategoricalAnnotationConfig {\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on ContinuousAnnotationConfig {\n            optimizationDirection\n            lowerBound\n            upperBound\n          }\n          ... on FreeformAnnotationConfig {\n            optimizationDirection\n            threshold\n            lowerBound\n            upperBound\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n        id\n      }\n      project {\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "35f2833525f4ad74f95afba6f9b16f4e";

export default node;
