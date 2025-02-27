/**
 * @generated SignedSource<<14677e94a55e0161a8ef310df2add7e5>>
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
                    "kind": "ScalarField",
                    "name": "authMethod",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "profilePictureUrl",
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
    "cacheID": "d3f85064b63f026a47a8ef139638b933",
    "id": null,
    "metadata": {},
    "name": "UsersTableQuery",
    "operationKind": "query",
    "text": "query UsersTableQuery {\n  ...UsersTable_users\n}\n\nfragment UsersTable_users on Query {\n  users {\n    edges {\n      user: node {\n        id\n        email\n        username\n        createdAt\n        authMethod\n        profilePictureUrl\n        role {\n          name\n        }\n      }\n    }\n  }\n}\n"
  }
};

(node as any).hash = "acd5e44c43deb927fea733697593c97d";

export default node;
