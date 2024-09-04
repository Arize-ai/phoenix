/**
 * @generated SignedSource<<53068c46a6b3b61488315dff4e4ad437>>
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
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "cd87c66812c50e80c23448d835b9ab43",
    "id": null,
    "metadata": {},
    "name": "UserAPIKeysTableQuery",
    "operationKind": "query",
    "text": "query UserAPIKeysTableQuery {\n  ...UserAPIKeysTableFragment\n}\n\nfragment UserAPIKeysTableFragment on Query {\n  userApiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n}\n"
  }
};

(node as any).hash = "b74ea37cf5a935ebe3ce165a42a5fbf7";

export default node;
