/**
 * @generated SignedSource<<96ec569052abf8b45ce4397d94508b1f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type OAuth2GrantsTableQuery$variables = Record<PropertyKey, never>;
export type OAuth2GrantsTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"OAuth2GrantsTableFragment">;
};
export type OAuth2GrantsTableQuery = {
  response: OAuth2GrantsTableQuery$data;
  variables: OAuth2GrantsTableQuery$variables;
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
    "name": "OAuth2GrantsTableQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "OAuth2GrantsTableFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "OAuth2GrantsTableQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "OAuth2Grant",
        "kind": "LinkedField",
        "name": "oauth2Grants",
        "plural": true,
        "selections": [
          (v0/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "clientName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "clientId",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "isFirstParty",
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
            "kind": "ScalarField",
            "name": "lastUsedAt",
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
                "name": "username",
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
    "cacheID": "e7b9618c94f5d5e916b9e852751bd7a5",
    "id": null,
    "metadata": {},
    "name": "OAuth2GrantsTableQuery",
    "operationKind": "query",
    "text": "query OAuth2GrantsTableQuery {\n  ...OAuth2GrantsTableFragment\n}\n\nfragment OAuth2GrantsTableFragment on Query {\n  oauth2Grants {\n    id\n    clientName\n    clientId\n    isFirstParty\n    createdAt\n    expiresAt\n    lastUsedAt\n    user {\n      username\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "be2ea8a752ec3c9a3cf15cc5bc6165b3";

export default node;
