/**
 * @generated SignedSource<<2060e6c78878fb997233d3316fea6d4b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SystemAPIKeysTableQuery$variables = Record<PropertyKey, never>;
export type SystemAPIKeysTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"SystemAPIKeysTableFragment">;
};
export type SystemAPIKeysTableQuery = {
  response: SystemAPIKeysTableQuery$data;
  variables: SystemAPIKeysTableQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "SystemAPIKeysTableQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "SystemAPIKeysTableFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SystemAPIKeysTableQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SystemApiKey",
        "kind": "LinkedField",
        "name": "systemApiKeys",
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
    "cacheID": "94e06b8cd5879701a5d73bee083ad614",
    "id": null,
    "metadata": {},
    "name": "SystemAPIKeysTableQuery",
    "operationKind": "query",
    "text": "query SystemAPIKeysTableQuery {\n  ...SystemAPIKeysTableFragment\n}\n\nfragment SystemAPIKeysTableFragment on Query {\n  systemApiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n}\n"
  }
};

(node as any).hash = "de0fc04de739f0adfcbdeaff28b16265";

export default node;
