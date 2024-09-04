/**
 * @generated SignedSource<<87527227e2af250a58dfb79cbd126a32>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
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
var v0 = [
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
        "selections": (v0/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "UserApiKey",
        "kind": "LinkedField",
        "name": "userApiKeys",
        "plural": true,
        "selections": (v0/*: any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b5ca39f5901adfac7e884cb2555989fa",
    "id": null,
    "metadata": {},
    "name": "APIKeysCardQuery",
    "operationKind": "query",
    "text": "query APIKeysCardQuery {\n  ...SystemAPIKeysTableFragment\n  ...UserAPIKeysTableFragment\n}\n\nfragment SystemAPIKeysTableFragment on Query {\n  systemApiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n}\n\nfragment UserAPIKeysTableFragment on Query {\n  userApiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "ad967afd45af0d5976982c70eaadb330";

export default node;
