/**
 * @generated SignedSource<<9e40a51149ed2b8af8e110739eacab3f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type UsersTableQuery$variables = Record<PropertyKey, never>;
export type UsersTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"UsersTable_users">;
};
export type UsersTableQuery = {
  response: UsersTableQuery$data;
  variables: UsersTableQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "UsersTableQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "UsersTable_users"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "UsersTableQuery",
    "selections": [
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
                    "name": "id",
                    "storageKey": null
                  },
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
                        "name": "name",
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
    ]
  },
  "params": {
    "cacheID": "0245c1369e7c90133ed938ba989f6d18",
    "id": null,
    "metadata": {},
    "name": "UsersTableQuery",
    "operationKind": "query",
    "text": "query UsersTableQuery {\n  ...UsersTable_users\n}\n\nfragment UsersTable_users on Query {\n  users {\n    edges {\n      user: node {\n        id\n        email\n        username\n        createdAt\n        role {\n          name\n        }\n      }\n    }\n  }\n}\n"
  }
};

(node as any).hash = "8ee32a96431dda537d1322a7623a8107";

export default node;
