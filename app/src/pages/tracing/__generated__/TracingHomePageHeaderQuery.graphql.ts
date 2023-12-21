/**
 * @generated SignedSource<<04c83d3d78b0deb499bdf250b59941ee>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TracingHomePageHeaderQuery$variables = {};
export type TracingHomePageHeaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"TracingHomePageHeader_stats">;
};
export type TracingHomePageHeaderQuery = {
  response: TracingHomePageHeaderQuery$data;
  variables: TracingHomePageHeaderQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "TracingHomePageHeaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "TracingHomePageHeader_stats"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "TracingHomePageHeaderQuery",
    "selections": [
      {
        "alias": "totalTraces",
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
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "TraceDatasetInfo",
        "kind": "LinkedField",
        "name": "traceDatasetInfo",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "startTime",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "endTime",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "tokenCountTotal",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "latencyMsP50",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "latencyMsP99",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "spanEvaluationNames",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "documentEvaluationNames",
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "776446b6c16605a140c7f3fca1073bfa",
    "id": null,
    "metadata": {},
    "name": "TracingHomePageHeaderQuery",
    "operationKind": "query",
    "text": "query TracingHomePageHeaderQuery {\n  ...TracingHomePageHeader_stats\n}\n\nfragment TracingHomePageHeader_stats on Query {\n  totalTraces: spans(rootSpansOnly: true) {\n    pageInfo {\n      totalCount\n    }\n  }\n  traceDatasetInfo {\n    startTime\n    endTime\n    tokenCountTotal\n    latencyMsP50\n    latencyMsP99\n  }\n  spanEvaluationNames\n  documentEvaluationNames\n}\n"
  }
};

(node as any).hash = "631360b4ed0a5a26238d4c2aea1bd759";

export default node;
