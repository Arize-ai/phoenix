/**
 * @generated SignedSource<<f59d416b7bd21b2a895a6ed0b2324ba8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SortDir = "asc" | "desc";
export type SpanColumn = "endTime" | "latencyMs" | "startTime" | "tokenCountCompletion" | "tokenCountPrompt" | "tokenCountTotal";
export type SpanSort = {
  col: SpanColumn;
  dir: SortDir;
};
export type TracesTableQuery$variables = {
  after?: string | null;
  first?: number | null;
  sort?: SpanSort | null;
};
export type TracesTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"TracesTable_spans">;
};
export type TracesTableQuery = {
  response: TracesTableQuery$data;
  variables: TracesTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": 100,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": {
      "col": "startTime",
      "dir": "desc"
    },
    "kind": "LocalArgument",
    "name": "sort"
  }
],
v1 = {
  "kind": "Variable",
  "name": "after",
  "variableName": "after"
},
v2 = {
  "kind": "Variable",
  "name": "first",
  "variableName": "first"
},
v3 = {
  "kind": "Variable",
  "name": "sort",
  "variableName": "sort"
},
v4 = [
  (v1/*: any*/),
  (v2/*: any*/),
  {
    "kind": "Literal",
    "name": "rootSpansOnly",
    "value": true
  },
  (v3/*: any*/)
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "statusCode",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v11 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  }
],
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v11/*: any*/),
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v11/*: any*/),
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanContext",
  "kind": "LinkedField",
  "name": "context",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "spanId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "traceId",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TracesTableQuery",
    "selections": [
      {
        "args": [
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/)
        ],
        "kind": "FragmentSpread",
        "name": "TracesTable_spans"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "TracesTableQuery",
    "selections": [
      {
        "alias": "rootSpans",
        "args": (v4/*: any*/),
        "concreteType": "SpanConnection",
        "kind": "LinkedField",
        "name": "spans",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "SpanEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": "rootSpan",
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v9/*: any*/),
                  {
                    "alias": "tokenCountTotal",
                    "args": null,
                    "kind": "ScalarField",
                    "name": "cumulativeTokenCountTotal",
                    "storageKey": null
                  },
                  (v10/*: any*/),
                  (v12/*: any*/),
                  (v13/*: any*/),
                  (v14/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Span",
                    "kind": "LinkedField",
                    "name": "descendants",
                    "plural": true,
                    "selections": [
                      (v5/*: any*/),
                      (v6/*: any*/),
                      (v7/*: any*/),
                      (v8/*: any*/),
                      (v9/*: any*/),
                      (v10/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "tokenCountTotal",
                        "storageKey": null
                      },
                      (v12/*: any*/),
                      (v13/*: any*/),
                      (v14/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
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
                "name": "endCursor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hasNextPage",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": "rootSpans",
        "args": (v4/*: any*/),
        "filters": [
          "sort",
          "rootSpansOnly"
        ],
        "handle": "connection",
        "key": "TracesTable_rootSpans",
        "kind": "LinkedHandle",
        "name": "spans"
      }
    ]
  },
  "params": {
    "cacheID": "6448711062b2f2c94176a0f34006db09",
    "id": null,
    "metadata": {},
    "name": "TracesTableQuery",
    "operationKind": "query",
    "text": "query TracesTableQuery(\n  $after: String = null\n  $first: Int = 100\n  $sort: SpanSort = {col: startTime, dir: desc}\n) {\n  ...TracesTable_spans_dWkdd\n}\n\nfragment TracesTable_spans_dWkdd on Query {\n  rootSpans: spans(first: $first, after: $after, sort: $sort, rootSpansOnly: true) {\n    edges {\n      rootSpan: node {\n        spanKind\n        name\n        statusCode\n        startTime\n        latencyMs\n        tokenCountTotal: cumulativeTokenCountTotal\n        parentId\n        input {\n          value\n        }\n        output {\n          value\n        }\n        context {\n          spanId\n          traceId\n        }\n        descendants {\n          spanKind\n          name\n          statusCode\n          startTime\n          latencyMs\n          parentId\n          tokenCountTotal\n          input {\n            value\n          }\n          output {\n            value\n          }\n          context {\n            spanId\n            traceId\n          }\n        }\n      }\n      cursor\n      node {\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6bc0cdddafa70b00a207cf4321ded880";

export default node;
