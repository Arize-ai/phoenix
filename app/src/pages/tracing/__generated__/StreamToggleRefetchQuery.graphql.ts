/**
 * @generated SignedSource<<c0429c8bb824228fa61616c844a933bf>>
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
        "alias": "traceCount",
        "args": [
          {
            "kind": "Literal",
            "name": "rootSpansOnly",
            "value": true
          }
        ],
        "concreteType": "SpanConnection",
        "kind": "LinkedField",
        "name": "spans",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "PageInfo",
            "kind": "LinkedField",
            "name": "pageInfo",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "totalCount",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "spans(rootSpansOnly:true)"
      }
    ]
  },
  "params": {
    "cacheID": "949fa06e28f3194aafeba3d9a413a248",
    "id": null,
    "metadata": {},
    "name": "StreamToggleRefetchQuery",
    "operationKind": "query",
    "text": "query StreamToggleRefetchQuery {\n  ...StreamToggle_data\n}\n\nfragment StreamToggle_data on Query {\n  traceCount: spans(rootSpansOnly: true) {\n    pageInfo {\n      totalCount\n    }\n  }\n}\n"
  }
};

(node as any).hash = "e406600d5729deabc496989862c402e1";

export default node;
