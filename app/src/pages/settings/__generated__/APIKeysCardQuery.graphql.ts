/**
 * @generated SignedSource<<f06508887d1598beb1b6007eadc846c1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type APIKeysCardQuery$variables = Record<PropertyKey, never>;
export type APIKeysCardQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"SystemAPIKeysTableFragment" | "UserAPIKeysTableFragment">;
};
export type APIKeysCardQuery = {
  response: APIKeysCardQuery$data;
  variables: APIKeysCardQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "expiresAt",
  "storageKey": null
},
v5 = [
  (v0/*: any*/),
  (v1/*: any*/),
  (v2/*: any*/),
  (v3/*: any*/),
  (v4/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "APIKeysCardQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "SystemAPIKeysTableFragment"
      },
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
    "name": "APIKeysCardQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SystemApiKey",
        "kind": "LinkedField",
        "name": "systemApiKeys",
        "plural": true,
        "selections": (v5/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "UserApiKey",
            "kind": "LinkedField",
            "name": "apiKeys",
            "plural": true,
            "selections": (v5/*: any*/),
            "storageKey": null
          },
          (v0/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "UserApiKey",
        "kind": "LinkedField",
        "name": "userApiKeys",
        "plural": true,
        "selections": [
          (v0/*: any*/),
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
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
    "cacheID": "dffededefc14bbb83fd2538c612b4e32",
    "id": null,
    "metadata": {},
    "name": "APIKeysCardQuery",
    "operationKind": "query",
    "text": "query APIKeysCardQuery {\n  ...SystemAPIKeysTableFragment\n  ...UserAPIKeysTableFragment\n}\n\nfragment APIKeysTableFragment on User {\n  apiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n  id\n}\n\nfragment SystemAPIKeysTableFragment on Query {\n  systemApiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n  viewer {\n    ...APIKeysTableFragment\n    id\n  }\n}\n\nfragment UserAPIKeysTableFragment on Query {\n  userApiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n    user {\n      username\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ad967afd45af0d5976982c70eaadb330";

export default node;
