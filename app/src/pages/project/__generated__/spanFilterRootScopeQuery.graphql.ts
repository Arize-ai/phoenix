/**
 * @generated SignedSource<<eb09a96cc434c02ee9b7752325daee17>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type spanFilterRootScopeQuery$variables = {
  condition: string;
  id: string;
};
export type spanFilterRootScopeQuery$data = {
  readonly project: {
    readonly analyzeSpanFilterCondition?: {
      readonly selectsRootSpansOnly: boolean;
    };
  };
};
export type spanFilterRootScopeQuery = {
  response: spanFilterRootScopeQuery$data;
  variables: spanFilterRootScopeQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "condition"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "condition",
          "variableName": "condition"
        }
      ],
      "concreteType": "SpanFilterConditionAnalysis",
      "kind": "LinkedField",
      "name": "analyzeSpanFilterCondition",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "selectsRootSpansOnly",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "spanFilterRootScopeQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/)
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
    "name": "spanFilterRootScopeQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v2/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "bb35f28772294418ff7a3f3597975fc2",
    "id": null,
    "metadata": {},
    "name": "spanFilterRootScopeQuery",
    "operationKind": "query",
    "text": "query spanFilterRootScopeQuery(\n  $condition: String!\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      analyzeSpanFilterCondition(condition: $condition) {\n        selectsRootSpansOnly\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "eebfc44c1c951f2214b7422452fa2be2";

export default node;
