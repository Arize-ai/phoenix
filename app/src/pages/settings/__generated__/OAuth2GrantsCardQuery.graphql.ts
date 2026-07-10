/**
 * @generated SignedSource<<b53359822c4c5f2eb71df93e39762caf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type OAuth2GrantsCardQuery$variables = Record<PropertyKey, never>;
export type OAuth2GrantsCardQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"OAuth2GrantsTableFragment">;
};
export type OAuth2GrantsCardQuery = {
  response: OAuth2GrantsCardQuery$data;
  variables: OAuth2GrantsCardQuery$variables;
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
    "name": "OAuth2GrantsCardQuery",
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
    "name": "OAuth2GrantsCardQuery",
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
    "cacheID": "6f6ac3992ccc5afd66697c512f225d17",
    "id": null,
    "metadata": {},
    "name": "OAuth2GrantsCardQuery",
    "operationKind": "query",
    "text": "query OAuth2GrantsCardQuery {\n  ...OAuth2GrantsTableFragment\n}\n\nfragment OAuth2GrantsTableFragment on Query {\n  oauth2Grants {\n    id\n    clientName\n    clientId\n    isFirstParty\n    createdAt\n    expiresAt\n    lastUsedAt\n    user {\n      username\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "069f5e3b8b5728dfbaa8901fd943f6e1";

export default node;
