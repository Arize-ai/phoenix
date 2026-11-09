/**
 * @generated SignedSource<<b07cc4601d99491b769f1f7a8518566f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type decisionLoaderQuery$variables = {
  id: string;
};
export type decisionLoaderQuery$data = {
  readonly decision: {
    readonly __typename: "Decision";
    readonly id: string;
    readonly name: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type decisionLoaderQuery = {
  response: decisionLoaderQuery$data;
  variables: decisionLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "decisionLoaderQuery",
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
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/)
            ],
            "type": "Decision",
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
    "name": "decisionLoaderQuery",
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
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/)
            ],
            "type": "Decision",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8c878980c05db835a960cb729154bccd",
    "id": null,
    "metadata": {},
    "name": "decisionLoaderQuery",
    "operationKind": "query",
    "text": "query decisionLoaderQuery(\n  $id: ID!\n) {\n  decision: node(id: $id) {\n    __typename\n    ... on Decision {\n      id\n      name\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "3d7d06812e11f7dc6650b15c40064bb8";

export default node;
