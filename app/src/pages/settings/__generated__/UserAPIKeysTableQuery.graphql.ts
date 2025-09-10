/**
 * @generated SignedSource<<0b147c21920903dfd612e378fa5e63cf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type UserAPIKeysTableQuery$variables = Record<PropertyKey, never>;
export type UserAPIKeysTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"UserAPIKeysTableFragment">;
};
export type UserAPIKeysTableQuery = {
  response: UserAPIKeysTableQuery$data;
  variables: UserAPIKeysTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
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
          (v0/*: any*/),
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
              },
              (v0/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a91e7a740880f47e1bcd063ede287ed6",
    "id": null,
    "metadata": {},
    "name": "UserAPIKeysTableQuery",
    "operationKind": "query",
    "text": "query UserAPIKeysTableQuery {\n  ...UserAPIKeysTableFragment\n}\n\nfragment UserAPIKeysTableFragment on Query {\n  userApiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n    user {\n      email\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c2b3a579bcb0ba915523ecb35cae3b44";

export default node;
