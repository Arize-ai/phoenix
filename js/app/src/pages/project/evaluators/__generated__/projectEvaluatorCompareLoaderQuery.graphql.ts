/**
 * @generated SignedSource<<227257c50fcf301db5acfc98473629d5>>
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
};
export type projectEvaluatorCompareLoaderQuery = {
  response: projectEvaluatorCompareLoaderQuery$data;
  variables: projectEvaluatorCompareLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "evaluatorAId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "evaluatorBId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "evaluatorAId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
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
  "name": "evaluationTarget",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": [
    (v3/*:: as any*/)
  ],
  "storageKey": null
},
v7 = [
  (v2/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v3/*:: as any*/),
      (v4/*:: as any*/),
      (v5/*:: as any*/),
      (v6/*:: as any*/)
    ],
    "type": "ProjectEvaluator",
    "abstractKey": null
  }
],
v8 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "evaluatorBId"
  }
],
v9 = [
  (v2/*:: as any*/),
  (v3/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v4/*:: as any*/),
      (v5/*:: as any*/),
      (v6/*:: as any*/)
    ],
    "type": "ProjectEvaluator",
    "abstractKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "projectEvaluatorCompareLoaderQuery",
    "selections": [
      {
        "alias": "evaluatorA",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v7/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": "evaluatorB",
        "args": (v8/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v7/*:: as any*/),
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
    "name": "projectEvaluatorCompareLoaderQuery",
    "selections": [
      {
        "alias": "evaluatorA",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v9/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": "evaluatorB",
        "args": (v8/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": (v9/*:: as any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "818ea98848023179b6ee62806b20946f",
    "id": null,
    "metadata": {},
    "name": "projectEvaluatorCompareLoaderQuery",
    "operationKind": "query",
    "text": "query projectEvaluatorCompareLoaderQuery(\n  $evaluatorAId: ID!\n  $evaluatorBId: ID!\n) {\n  evaluatorA: node(id: $evaluatorAId) {\n    __typename\n    ... on ProjectEvaluator {\n      id\n      name\n      evaluationTarget\n      project {\n        id\n      }\n    }\n    id\n  }\n  evaluatorB: node(id: $evaluatorBId) {\n    __typename\n    ... on ProjectEvaluator {\n      id\n      name\n      evaluationTarget\n      project {\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "6b5910de1727698759b789104c36d9c4";

export default node;
