/**
 * @generated SignedSource<<550ecd760d5cc4c3278fa26b4c1c001b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type UserAPIKeysTableQuery$variables = Record<PropertyKey, never>;
export type UserAPIKeysTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"UserAPIKeysTableFragment">;
};
export type UserAPIKeysTableQuery = {
  response: UserAPIKeysTableQuery$data;
  variables: UserAPIKeysTableQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "UserAPIKeysTableQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "UserAPIKeysTableFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "UserAPIKeysTableQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "UserApiKey",
        "kind": "LinkedField",
        "name": "userApiKeys",
        "plural": true,
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
            "name": "name",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "description",
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
            "name": "expiresAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "user",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "email",
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
    "cacheID": "e70d413b072841dff8565a332590a549",
    "id": null,
    "metadata": {},
    "name": "UserAPIKeysTableQuery",
    "operationKind": "query",
    "text": "query UserAPIKeysTableQuery {\n  ...UserAPIKeysTableFragment\n}\n\nfragment UserAPIKeysTableFragment on Query {\n  userApiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n    user {\n      email\n    }\n  }\n}\n"
  }
};

(node as any).hash = "c2b3a579bcb0ba915523ecb35cae3b44";

export default node;
