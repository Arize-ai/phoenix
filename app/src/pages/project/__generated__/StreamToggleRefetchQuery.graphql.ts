/**
 * @generated SignedSource<<dc88f75abf5e9ea3d81844e5ee5d7c56>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type StreamToggleRefetchQuery$variables = {};
export type StreamToggleRefetchQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"StreamToggle_data">;
};
export type StreamToggleRefetchQuery = {
  response: StreamToggleRefetchQuery$data;
  variables: StreamToggleRefetchQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "StreamToggleRefetchQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "StreamToggle_data"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "StreamToggleRefetchQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "streamingLastUpdatedAt",
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "5572910398dea8c13b54fae773bdef69",
    "id": null,
    "metadata": {},
    "name": "StreamToggleRefetchQuery",
    "operationKind": "query",
    "text": "query StreamToggleRefetchQuery {\n  ...StreamToggle_data\n}\n\nfragment StreamToggle_data on Query {\n  streamingLastUpdatedAt\n}\n"
  }
};

(node as any).hash = "5a87fc2da6f4964259d4eaaaed28e26a";

export default node;
