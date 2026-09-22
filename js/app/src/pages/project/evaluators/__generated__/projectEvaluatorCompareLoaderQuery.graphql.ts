/**
 * @generated SignedSource<<9f1b93d0320316b733eeeb3f97e6b8eb>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type projectEvaluatorCompareLoaderQuery$variables = {
  evaluatorAId: string;
  evaluatorBId: string;
  projectId: string;
};
export type projectEvaluatorCompareLoaderQuery$data = {
  readonly evaluatorA: {
    readonly __typename: "ProjectEvaluator";
    readonly evaluationTarget: EvaluationTarget;
    readonly id: string;
    readonly name: string;
    readonly project: {
      readonly id: string;
    };
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareContent_evaluator">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly evaluatorB: {
    readonly __typename: "ProjectEvaluator";
    readonly evaluationTarget: EvaluationTarget;
    readonly id: string;
    readonly name: string;
    readonly project: {
      readonly id: string;
    };
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareContent_evaluator">;
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
v10 = [
  (v5/*:: as any*/)
],
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": (v10/*:: as any*/),
  "storageKey": null
},
v12 = [
  (v4/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v5/*:: as any*/),
      (v6/*:: as any*/),
      (v7/*:: as any*/),
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ProjectEvaluatorCompareContent_evaluator"
      },
      (v11/*:: as any*/)
    ],
    "type": "ProjectEvaluator",
    "abstractKey": null
  }
],
v13 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "evaluatorBId"
  }
],
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v17 = [
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
              {
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
              {
                "kind": "InlineFragment",
                "selections": [
                  (v14/*:: as any*/),
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
                  (v14/*:: as any*/),
                  (v15/*:: as any*/),
                  (v16/*:: as any*/)
                ],
                "type": "ContinuousAnnotationConfig",
                "abstractKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": [
                  (v14/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "threshold",
                    "storageKey": null
                  },
                  (v15/*:: as any*/),
                  (v16/*:: as any*/)
                ],
                "type": "FreeformAnnotationConfig",
                "abstractKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": (v10/*:: as any*/),
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
      (v11/*:: as any*/)
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
        "selections": (v12/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": "evaluatorB",
        "args": (v13/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v12/*:: as any*/),
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
        "selections": (v17/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": "evaluatorB",
        "args": (v13/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v17/*:: as any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "59f29e2272144cf9e919e7a1e7a55df4",
    "id": null,
    "metadata": {},
    "name": "projectEvaluatorCompareLoaderQuery",
    "operationKind": "query",
    "text": "query projectEvaluatorCompareLoaderQuery(\n  $projectId: ID!\n  $evaluatorAId: ID!\n  $evaluatorBId: ID!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluators(first: 100) {\n        edges {\n          evaluator: node {\n            id\n            name\n            evaluationTarget\n          }\n        }\n      }\n    }\n    id\n  }\n  evaluatorA: node(id: $evaluatorAId) {\n    __typename\n    ... on ProjectEvaluator {\n      id\n      name\n      evaluationTarget\n      ...ProjectEvaluatorCompareContent_evaluator\n      project {\n        id\n      }\n    }\n    id\n  }\n  evaluatorB: node(id: $evaluatorBId) {\n    __typename\n    ... on ProjectEvaluator {\n      id\n      name\n      evaluationTarget\n      ...ProjectEvaluatorCompareContent_evaluator\n      project {\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment ProjectEvaluatorCompareContent_evaluator on ProjectEvaluator {\n  id\n  name\n  ...ProjectEvaluatorCompareStats_evaluator\n  ...ProjectEvaluatorCompareMatrix_evaluator\n  ...ProjectEvaluatorCompareTargets_evaluator\n}\n\nfragment ProjectEvaluatorCompareMatrix_evaluator on ProjectEvaluator {\n  name\n  evaluator {\n    __typename\n    outputConfigs {\n      __typename\n      ... on CategoricalAnnotationConfig {\n        optimizationDirection\n      }\n      ... on ContinuousAnnotationConfig {\n        optimizationDirection\n      }\n      ... on FreeformAnnotationConfig {\n        optimizationDirection\n      }\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment ProjectEvaluatorCompareStats_evaluator on ProjectEvaluator {\n  name\n  evaluator {\n    __typename\n    outputConfigs {\n      __typename\n      ... on AnnotationConfigBase {\n        __isAnnotationConfigBase: __typename\n        name\n        annotationType\n      }\n      ... on CategoricalAnnotationConfig {\n        optimizationDirection\n        values {\n          label\n          score\n        }\n      }\n      ... on ContinuousAnnotationConfig {\n        optimizationDirection\n        lowerBound\n        upperBound\n      }\n      ... on FreeformAnnotationConfig {\n        optimizationDirection\n        threshold\n        lowerBound\n        upperBound\n      }\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment ProjectEvaluatorCompareTargets_evaluator on ProjectEvaluator {\n  evaluator {\n    __typename\n    outputConfigs {\n      __typename\n      ... on CategoricalAnnotationConfig {\n        optimizationDirection\n      }\n      ... on ContinuousAnnotationConfig {\n        optimizationDirection\n      }\n      ... on FreeformAnnotationConfig {\n        optimizationDirection\n      }\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "612574dd07c2fe23ef15a21ed6af35d2";

export default node;
