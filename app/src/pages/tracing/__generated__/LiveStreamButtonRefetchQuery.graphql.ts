/**
 * @generated SignedSource<<c3c023b56d6a416beab4757c8df854e3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LiveStreamButtonRefetchQuery$variables = {};
export type LiveStreamButtonRefetchQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"LiveStreamButton_data">;
};
export type LiveStreamButtonRefetchQuery = {
  response: LiveStreamButtonRefetchQuery$data;
  variables: LiveStreamButtonRefetchQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "LiveStreamButtonRefetchQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "LiveStreamButton_data"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "LiveStreamButtonRefetchQuery",
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
    "cacheID": "a0e3062a55dbc6d5f9c66ca82b1f8b25",
    "id": null,
    "metadata": {},
    "name": "LiveStreamButtonRefetchQuery",
    "operationKind": "query",
    "text": "query LiveStreamButtonRefetchQuery {\n  ...LiveStreamButton_data\n}\n\nfragment LiveStreamButton_data on Query {\n  traceCount: spans(rootSpansOnly: true) {\n    pageInfo {\n      totalCount\n    }\n  }\n}\n"
  }
};

(node as any).hash = "96942eb23b7285a8b31284cda62a9f93";

export default node;
