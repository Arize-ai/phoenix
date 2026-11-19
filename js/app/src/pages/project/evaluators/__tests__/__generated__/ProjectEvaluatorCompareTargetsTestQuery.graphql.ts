/**
 * @generated SignedSource<<c87108a086abb1ae6779f44398ee85c7>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorCompareTargetsTestQuery$variables = Record<PropertyKey, never>;
export type ProjectEvaluatorCompareTargetsTestQuery$data = {
  readonly evaluatorA: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareTargets_evaluator">;
  };
  readonly evaluatorB: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareTargets_evaluator">;
  };
  readonly project: {
    readonly evaluatorComparison?: {
      readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorCompareTargets_comparison">;
    };
  };
};
export type ProjectEvaluatorCompareTargetsTestQuery = {
  response: ProjectEvaluatorCompareTargetsTestQuery$data;
  variables: ProjectEvaluatorCompareTargetsTestQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "id",
    "value": "UHJvamVjdDox"
  }
],
v1 = [
  {
    "kind": "Literal",
    "name": "evaluatorAId",
    "value": "ProjectEvaluator:1"
  },
  {
    "kind": "Literal",
    "name": "evaluatorBId",
    "value": "ProjectEvaluator:2"
  },
  {
    "kind": "Literal",
    "name": "timeRange",
    "value": {
      "end": "2026-07-02T00:00:00.000Z",
      "start": "2026-07-01T00:00:00.000Z"
    }
  }
],
v2 = [
  {
    "kind": "Literal",
    "name": "id",
    "value": "ProjectEvaluator:1"
  }
],
v3 = [
  {
    "kind": "InlineFragment",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ProjectEvaluatorCompareTargets_evaluator"
      }
    ],
    "type": "ProjectEvaluator",
    "abstractKey": null
  }
],
v4 = [
  {
    "kind": "Literal",
    "name": "id",
    "value": "ProjectEvaluator:2"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v6 = [
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
    "name": "labels",
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
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v8 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "optimizationDirection",
    "storageKey": null
  }
],
v9 = [
  (v5/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": null,
        "kind": "LinkedField",
        "name": "evaluator",
        "plural": false,
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
              (v5/*:: as any*/),
              {
                "kind": "InlineFragment",
                "selections": (v8/*:: as any*/),
                "type": "CategoricalAnnotationConfig",
                "abstractKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": (v8/*:: as any*/),
                "type": "ContinuousAnnotationConfig",
                "abstractKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": (v8/*:: as any*/),
                "type": "FreeformAnnotationConfig",
                "abstractKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": [
                  (v7/*:: as any*/)
                ],
                "type": "Node",
                "abstractKey": "__isNode"
              }
            ],
            "storageKey": null
          },
          (v7/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "ProjectEvaluator",
    "abstractKey": null
  },
  (v7/*:: as any*/)
],
v10 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "Node"
},
v11 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "String"
},
v12 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "Evaluator"
},
v13 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "ID"
},
v14 = {
  "enumValues": null,
  "nullable": false,
  "plural": true,
  "type": "BuiltInEvaluatorOutputConfig"
},
v15 = {
  "enumValues": [
    "MINIMIZE",
    "MAXIMIZE",
    "NONE"
  ],
  "nullable": false,
  "plural": false,
  "type": "OptimizationDirection"
},
v16 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "EvaluatorComparisonSummary"
},
v17 = {
  "enumValues": null,
  "nullable": false,
  "plural": true,
  "type": "String"
},
v18 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "Float"
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorCompareTargetsTestQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v0/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v1/*:: as any*/),
                "concreteType": "ProjectEvaluatorComparison",
                "kind": "LinkedField",
                "name": "evaluatorComparison",
                "plural": false,
                "selections": [
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "ProjectEvaluatorCompareTargets_comparison"
                  }
                ],
                "storageKey": "evaluatorComparison(evaluatorAId:\"ProjectEvaluator:1\",evaluatorBId:\"ProjectEvaluator:2\",timeRange:{\"end\":\"2026-07-02T00:00:00.000Z\",\"start\":\"2026-07-01T00:00:00.000Z\"})"
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": "node(id:\"UHJvamVjdDox\")"
      },
      {
        "alias": "evaluatorA",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v3/*:: as any*/),
        "storageKey": "node(id:\"ProjectEvaluator:1\")"
      },
      {
        "alias": "evaluatorB",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v3/*:: as any*/),
        "storageKey": "node(id:\"ProjectEvaluator:2\")"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ProjectEvaluatorCompareTargetsTestQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v0/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v1/*:: as any*/),
                "concreteType": "ProjectEvaluatorComparison",
                "kind": "LinkedField",
                "name": "evaluatorComparison",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "evaluationTarget",
                    "storageKey": null
                  },
                  {
                    "alias": "sideA",
                    "args": null,
                    "concreteType": "EvaluatorComparisonSummary",
                    "kind": "LinkedField",
                    "name": "a",
                    "plural": false,
                    "selections": (v6/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": "sideB",
                    "args": null,
                    "concreteType": "EvaluatorComparisonSummary",
                    "kind": "LinkedField",
                    "name": "b",
                    "plural": false,
                    "selections": (v6/*:: as any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": "evaluatorComparison(evaluatorAId:\"ProjectEvaluator:1\",evaluatorBId:\"ProjectEvaluator:2\",timeRange:{\"end\":\"2026-07-02T00:00:00.000Z\",\"start\":\"2026-07-01T00:00:00.000Z\"})"
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
          (v7/*:: as any*/)
        ],
        "storageKey": "node(id:\"UHJvamVjdDox\")"
      },
      {
        "alias": "evaluatorA",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v9/*:: as any*/),
        "storageKey": "node(id:\"ProjectEvaluator:1\")"
      },
      {
        "alias": "evaluatorB",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v9/*:: as any*/),
        "storageKey": "node(id:\"ProjectEvaluator:2\")"
      }
    ]
  },
  "params": {
    "cacheID": "886c9915c8223b4ea8b1af62ba6f56c0",
    "id": null,
    "metadata": {
      "relayTestingSelectionTypeInfo": {
        "evaluatorA": (v10/*:: as any*/),
        "evaluatorA.__typename": (v11/*:: as any*/),
        "evaluatorA.evaluator": (v12/*:: as any*/),
        "evaluatorA.evaluator.__typename": (v11/*:: as any*/),
        "evaluatorA.evaluator.id": (v13/*:: as any*/),
        "evaluatorA.evaluator.outputConfigs": (v14/*:: as any*/),
        "evaluatorA.evaluator.outputConfigs.__isNode": (v11/*:: as any*/),
        "evaluatorA.evaluator.outputConfigs.__typename": (v11/*:: as any*/),
        "evaluatorA.evaluator.outputConfigs.id": (v13/*:: as any*/),
        "evaluatorA.evaluator.outputConfigs.optimizationDirection": (v15/*:: as any*/),
        "evaluatorA.id": (v13/*:: as any*/),
        "evaluatorB": (v10/*:: as any*/),
        "evaluatorB.__typename": (v11/*:: as any*/),
        "evaluatorB.evaluator": (v12/*:: as any*/),
        "evaluatorB.evaluator.__typename": (v11/*:: as any*/),
        "evaluatorB.evaluator.id": (v13/*:: as any*/),
        "evaluatorB.evaluator.outputConfigs": (v14/*:: as any*/),
        "evaluatorB.evaluator.outputConfigs.__isNode": (v11/*:: as any*/),
        "evaluatorB.evaluator.outputConfigs.__typename": (v11/*:: as any*/),
        "evaluatorB.evaluator.outputConfigs.id": (v13/*:: as any*/),
        "evaluatorB.evaluator.outputConfigs.optimizationDirection": (v15/*:: as any*/),
        "evaluatorB.id": (v13/*:: as any*/),
        "project": (v10/*:: as any*/),
        "project.__typename": (v11/*:: as any*/),
        "project.evaluatorComparison": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "ProjectEvaluatorComparison"
        },
        "project.evaluatorComparison.evaluationTarget": {
          "enumValues": [
            "SPAN",
            "TRACE",
            "SESSION"
          ],
          "nullable": false,
          "plural": false,
          "type": "EvaluationTarget"
        },
        "project.evaluatorComparison.sideA": (v16/*:: as any*/),
        "project.evaluatorComparison.sideA.annotationName": (v11/*:: as any*/),
        "project.evaluatorComparison.sideA.labels": (v17/*:: as any*/),
        "project.evaluatorComparison.sideA.threshold": (v18/*:: as any*/),
        "project.evaluatorComparison.sideB": (v16/*:: as any*/),
        "project.evaluatorComparison.sideB.annotationName": (v11/*:: as any*/),
        "project.evaluatorComparison.sideB.labels": (v17/*:: as any*/),
        "project.evaluatorComparison.sideB.threshold": (v18/*:: as any*/),
        "project.id": (v13/*:: as any*/)
      }
    },
    "name": "ProjectEvaluatorCompareTargetsTestQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorCompareTargetsTestQuery {\n  project: node(id: \"UHJvamVjdDox\") {\n    __typename\n    ... on Project {\n      evaluatorComparison(evaluatorAId: \"ProjectEvaluator:1\", evaluatorBId: \"ProjectEvaluator:2\", timeRange: {start: \"2026-07-01T00:00:00.000Z\", end: \"2026-07-02T00:00:00.000Z\"}) {\n        ...ProjectEvaluatorCompareTargets_comparison\n      }\n    }\n    id\n  }\n  evaluatorA: node(id: \"ProjectEvaluator:1\") {\n    __typename\n    ... on ProjectEvaluator {\n      ...ProjectEvaluatorCompareTargets_evaluator\n    }\n    id\n  }\n  evaluatorB: node(id: \"ProjectEvaluator:2\") {\n    __typename\n    ... on ProjectEvaluator {\n      ...ProjectEvaluatorCompareTargets_evaluator\n    }\n    id\n  }\n}\n\nfragment ProjectEvaluatorCompareTargets_comparison on ProjectEvaluatorComparison {\n  evaluationTarget\n  sideA: a {\n    annotationName\n    labels\n    threshold\n  }\n  sideB: b {\n    annotationName\n    labels\n    threshold\n  }\n}\n\nfragment ProjectEvaluatorCompareTargets_evaluator on ProjectEvaluator {\n  evaluator {\n    __typename\n    outputConfigs {\n      __typename\n      ... on CategoricalAnnotationConfig {\n        optimizationDirection\n      }\n      ... on ContinuousAnnotationConfig {\n        optimizationDirection\n      }\n      ... on FreeformAnnotationConfig {\n        optimizationDirection\n      }\n      ... on Node {\n        __isNode: __typename\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "6b81b5e882994e1c5721bba8bd6c5dff";

export default node;
