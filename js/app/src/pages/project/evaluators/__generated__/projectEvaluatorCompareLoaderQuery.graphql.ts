/**
 * @generated SignedSource<<eb66dd1ec15f4e4861bfc2c6ce53e0c2>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
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
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": [
    (v5/*:: as any*/)
  ],
  "storageKey": null
},
v11 = [
  (v4/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v5/*:: as any*/),
      (v6/*:: as any*/),
      (v7/*:: as any*/),
      (v10/*:: as any*/)
    ],
    "type": "ProjectEvaluator",
    "abstractKey": null
  }
],
v12 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "evaluatorBId"
  }
],
v13 = [
  (v4/*:: as any*/),
  (v5/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v6/*:: as any*/),
      (v7/*:: as any*/),
      (v10/*:: as any*/)
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
        "selections": (v11/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": "evaluatorB",
        "args": (v12/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v11/*:: as any*/),
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
        "selections": (v13/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": "evaluatorB",
        "args": (v12/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v13/*:: as any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "563f6ad1886d0addd21b38c2dcc526cf",
    "id": null,
    "metadata": {},
    "name": "projectEvaluatorCompareLoaderQuery",
    "operationKind": "query",
    "text": "query projectEvaluatorCompareLoaderQuery(\n  $projectId: ID!\n  $evaluatorAId: ID!\n  $evaluatorBId: ID!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluators(first: 100) {\n        edges {\n          evaluator: node {\n            id\n            name\n            evaluationTarget\n          }\n        }\n      }\n    }\n    id\n  }\n  evaluatorA: node(id: $evaluatorAId) {\n    __typename\n    ... on ProjectEvaluator {\n      id\n      name\n      evaluationTarget\n      project {\n        id\n      }\n    }\n    id\n  }\n  evaluatorB: node(id: $evaluatorBId) {\n    __typename\n    ... on ProjectEvaluator {\n      id\n      name\n      evaluationTarget\n      project {\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "0a11cbfced34e92e040a82d14864ac65";

export default node;
