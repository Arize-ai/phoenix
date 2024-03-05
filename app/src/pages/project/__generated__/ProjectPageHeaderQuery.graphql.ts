/**
 * @generated SignedSource<<73a30c7c229b3c595175dbf429fce859>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageHeaderQuery$variables = {};
export type ProjectPageHeaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ProjectPageHeader_stats">;
};
export type ProjectPageHeaderQuery = {
  response: ProjectPageHeaderQuery$data;
  variables: ProjectPageHeaderQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectPageHeaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ProjectPageHeader_stats"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ProjectPageHeaderQuery",
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
    "cacheID": "c378f55e69ccb0cfd2ec6626ffb77ac4",
    "id": null,
    "metadata": {},
    "name": "ProjectPageHeaderQuery",
    "operationKind": "query",
    "text": "query ProjectPageHeaderQuery {\n  ...ProjectPageHeader_stats\n}\n\nfragment ProjectPageHeader_stats on Query {\n  totalTraces: spans(rootSpansOnly: true) {\n    pageInfo {\n      totalCount\n    }\n  }\n  traceDatasetInfo {\n    startTime\n    endTime\n    tokenCountTotal\n    latencyMsP50\n    latencyMsP99\n  }\n  spanEvaluationNames\n  documentEvaluationNames\n}\n"
  }
};

(node as any).hash = "b5e575b779dea4366253bbfde728abe0";

export default node;
