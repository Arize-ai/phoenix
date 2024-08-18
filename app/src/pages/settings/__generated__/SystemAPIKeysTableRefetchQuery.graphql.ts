/**
 * @generated SignedSource<<27a738645f32bdb25f49fac2071d291a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SystemAPIKeysTableRefetchQuery$variables = Record<PropertyKey, never>;
export type SystemAPIKeysTableRefetchQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"SystemAPIKeysTableFragment">;
};
export type SystemAPIKeysTableRefetchQuery = {
  response: SystemAPIKeysTableRefetchQuery$data;
  variables: SystemAPIKeysTableRefetchQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "SystemAPIKeysTableRefetchQuery",
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
    "name": "SystemAPIKeysTableRefetchQuery",
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
    "cacheID": "454b9397a44c2b06b1f20ccf7f0b077e",
    "id": null,
    "metadata": {},
    "name": "SystemAPIKeysTableRefetchQuery",
    "operationKind": "query",
    "text": "query SystemAPIKeysTableRefetchQuery {\n  ...SystemAPIKeysTableFragment\n}\n\nfragment SystemAPIKeysTableFragment on Query {\n  systemApiKeys {\n    name\n    description\n    createdAt\n    expiresAt\n  }\n}\n"
  }
};

(node as any).hash = "5b1b306f178fa0e790415c5e375cba5f";

export default node;
