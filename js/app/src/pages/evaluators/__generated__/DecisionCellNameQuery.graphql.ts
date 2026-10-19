/**
 * @generated SignedSource<<3ab4c8b91742140b40631f30d6edb2e5>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionCellNameQuery$variables = {
  decisionId: string;
};
export type DecisionCellNameQuery$data = {
  readonly decision: {
    readonly __typename: "Decision";
    readonly name: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type DecisionCellNameQuery = {
  response: DecisionCellNameQuery$data;
  variables: DecisionCellNameQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "decisionId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "decisionId"
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    }
  ],
  "type": "Decision",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionCellNameQuery",
    "selections": [
      {
        "alias": "decision",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/)
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
    "name": "DecisionCellNameQuery",
    "selections": [
      {
        "alias": "decision",
        "args": (v1/*:: as any*/),
        "concreteType": null,
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
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ba150cee62e10f9de967be7336709baf",
    "id": null,
    "metadata": {},
    "name": "DecisionCellNameQuery",
    "operationKind": "query",
    "text": "query DecisionCellNameQuery(\n  $decisionId: ID!\n) {\n  decision: node(id: $decisionId) {\n    __typename\n    ... on Decision {\n      name\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "d5b06731b060badf7b44dcabea7b50e5";

export default node;
