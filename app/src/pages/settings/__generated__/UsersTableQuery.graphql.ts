/**
 * @generated SignedSource<<96972128813200007b3c171b91458cc9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type UsersTableQuery$variables = Record<PropertyKey, never>;
export type UsersTableQuery$data = {
  readonly users: {
    readonly edges: ReadonlyArray<{
      readonly user: {
        readonly createdAt: string;
        readonly email: string;
        readonly username: string | null;
      };
    }>;
  };
};
export type UsersTableQuery = {
  response: UsersTableQuery$data;
  variables: UsersTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "UserConnection",
    "kind": "LinkedField",
    "name": "users",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "UserEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": "user",
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "email",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "username",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "createdAt",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "UsersTableQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "UsersTableQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "0d0f6d7ad268e8b6864dadfaaf7fdb6f",
    "id": null,
    "metadata": {},
    "name": "UsersTableQuery",
    "operationKind": "query",
    "text": "query UsersTableQuery {\n  users {\n    edges {\n      user: node {\n        email\n        username\n        createdAt\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e3433be9d599897d186757122a0dc5a8";

export default node;
