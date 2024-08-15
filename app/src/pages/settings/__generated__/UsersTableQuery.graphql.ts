/**
 * @generated SignedSource<<c07c5f84d587b8b1a7e6918e393f5d0b>>
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
        readonly role: {
          readonly role: string;
        };
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
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "UserRole",
                "kind": "LinkedField",
                "name": "role",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "role",
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
    "cacheID": "5cefb7e1fadaa4daf3273449329b9a8f",
    "id": null,
    "metadata": {},
    "name": "UsersTableQuery",
    "operationKind": "query",
    "text": "query UsersTableQuery {\n  users {\n    edges {\n      user: node {\n        email\n        username\n        createdAt\n        role {\n          role\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "87a865d148c113262b821aeeb24b30c3";

export default node;
