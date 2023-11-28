/**
 * @generated SignedSource<<f2938602f247afaf506af24efd45c585>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TracingHomePageQuery$variables = {};
export type TracingHomePageQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"SpansTable_spans" | "StreamToggle_data" | "TracesTable_spans" | "TracingHomePageHeader_stats">;
};
export type TracingHomePageQuery = {
  response: TracingHomePageQuery$data;
  variables: TracingHomePageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "kind": "Literal",
  "name": "first",
  "value": 100
},
v1 = {
  "kind": "Literal",
  "name": "sort",
  "value": {
    "col": "startTime",
    "dir": "desc"
  }
},
v2 = [
  (v0/*: any*/),
  (v1/*: any*/)
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "statusCode",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokenCountTotal",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokenCountPrompt",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokenCountCompletion",
  "storageKey": null
},
v11 = {
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
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v13 = [
  (v12/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "mimeType",
    "storageKey": null
  }
],
v14 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanEvaluation",
  "kind": "LinkedField",
  "name": "spanEvaluations",
  "plural": true,
  "selections": [
    (v4/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "label",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "score",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v16 = {
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
},
v17 = {
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
},
v18 = {
  "kind": "Literal",
  "name": "rootSpansOnly",
  "value": true
},
v19 = [
  (v0/*: any*/),
  (v18/*: any*/),
  (v1/*: any*/)
],
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v21 = [
  (v12/*: any*/)
],
v22 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v21/*: any*/),
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v21/*: any*/),
  "storageKey": null
},
v24 = [
  (v18/*: any*/)
],
v25 = [
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
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "TracingHomePageQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "SpansTable_spans"
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "TracesTable_spans"
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "TracingHomePageHeader_stats"
      },
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
    "name": "TracingHomePageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
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
                "alias": "span",
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v9/*: any*/),
                  (v10/*: any*/),
                  (v11/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SpanIOValue",
                    "kind": "LinkedField",
                    "name": "input",
                    "plural": false,
                    "selections": (v13/*: any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SpanIOValue",
                    "kind": "LinkedField",
                    "name": "output",
                    "plural": false,
                    "selections": (v13/*: any*/),
                    "storageKey": null
                  },
                  (v14/*: any*/)
                ],
                "storageKey": null
              },
              (v15/*: any*/),
              (v16/*: any*/)
            ],
            "storageKey": null
          },
          (v17/*: any*/)
        ],
        "storageKey": "spans(first:100,sort:{\"col\":\"startTime\",\"dir\":\"desc\"})"
      },
      {
        "alias": null,
        "args": (v2/*: any*/),
        "filters": [
          "sort",
          "filterCondition"
        ],
        "handle": "connection",
        "key": "SpansTable_spans",
        "kind": "LinkedHandle",
        "name": "spans"
      },
      {
        "alias": "rootSpans",
        "args": (v19/*: any*/),
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
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  {
                    "alias": "tokenCountTotal",
                    "args": null,
                    "kind": "ScalarField",
                    "name": "cumulativeTokenCountTotal",
                    "storageKey": null
                  },
                  {
                    "alias": "tokenCountPrompt",
                    "args": null,
                    "kind": "ScalarField",
                    "name": "cumulativeTokenCountPrompt",
                    "storageKey": null
                  },
                  {
                    "alias": "tokenCountCompletion",
                    "args": null,
                    "kind": "ScalarField",
                    "name": "cumulativeTokenCountCompletion",
                    "storageKey": null
                  },
                  (v20/*: any*/),
                  (v22/*: any*/),
                  (v23/*: any*/),
                  (v11/*: any*/),
                  (v14/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Span",
                    "kind": "LinkedField",
                    "name": "descendants",
                    "plural": true,
                    "selections": [
                      (v3/*: any*/),
                      (v4/*: any*/),
                      (v5/*: any*/),
                      (v6/*: any*/),
                      (v7/*: any*/),
                      (v20/*: any*/),
                      (v8/*: any*/),
                      (v9/*: any*/),
                      (v10/*: any*/),
                      (v22/*: any*/),
                      (v23/*: any*/),
                      (v11/*: any*/),
                      (v14/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v15/*: any*/),
              (v16/*: any*/)
            ],
            "storageKey": null
          },
          (v17/*: any*/)
        ],
        "storageKey": "spans(first:100,rootSpansOnly:true,sort:{\"col\":\"startTime\",\"dir\":\"desc\"})"
      },
      {
        "alias": "rootSpans",
        "args": (v19/*: any*/),
        "filters": [
          "sort",
          "rootSpansOnly",
          "filterCondition"
        ],
        "handle": "connection",
        "key": "TracesTable_rootSpans",
        "kind": "LinkedHandle",
        "name": "spans"
      },
      {
        "alias": "totalTraces",
        "args": (v24/*: any*/),
        "concreteType": "SpanConnection",
        "kind": "LinkedField",
        "name": "spans",
        "plural": false,
        "selections": (v25/*: any*/),
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
          (v6/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "endTime",
            "storageKey": null
          },
          (v8/*: any*/),
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
        "alias": "traceCount",
        "args": (v24/*: any*/),
        "concreteType": "SpanConnection",
        "kind": "LinkedField",
        "name": "spans",
        "plural": false,
        "selections": (v25/*: any*/),
        "storageKey": "spans(rootSpansOnly:true)"
      }
    ]
  },
  "params": {
    "cacheID": "54108ef1d02b43bca1dc407ab4a8bd80",
    "id": null,
    "metadata": {},
    "name": "TracingHomePageQuery",
    "operationKind": "query",
    "text": "query TracingHomePageQuery {\n  ...SpansTable_spans\n  ...TracesTable_spans\n  ...TracingHomePageHeader_stats\n  ...StreamToggle_data\n}\n\nfragment SpansTable_spans on Query {\n  spans(first: 100, sort: {col: startTime, dir: desc}) {\n    edges {\n      span: node {\n        spanKind\n        name\n        statusCode\n        startTime\n        latencyMs\n        tokenCountTotal\n        tokenCountPrompt\n        tokenCountCompletion\n        context {\n          spanId\n          traceId\n        }\n        input {\n          value\n          mimeType\n        }\n        output {\n          value\n          mimeType\n        }\n        spanEvaluations {\n          name\n          label\n          score\n        }\n      }\n      cursor\n      node {\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment StreamToggle_data on Query {\n  traceCount: spans(rootSpansOnly: true) {\n    pageInfo {\n      totalCount\n    }\n  }\n}\n\nfragment TracesTable_spans on Query {\n  rootSpans: spans(first: 100, sort: {col: startTime, dir: desc}, rootSpansOnly: true) {\n    edges {\n      rootSpan: node {\n        spanKind\n        name\n        statusCode\n        startTime\n        latencyMs\n        tokenCountTotal: cumulativeTokenCountTotal\n        tokenCountPrompt: cumulativeTokenCountPrompt\n        tokenCountCompletion: cumulativeTokenCountCompletion\n        parentId\n        input {\n          value\n        }\n        output {\n          value\n        }\n        context {\n          spanId\n          traceId\n        }\n        spanEvaluations {\n          name\n          label\n          score\n        }\n        descendants {\n          spanKind\n          name\n          statusCode\n          startTime\n          latencyMs\n          parentId\n          tokenCountTotal\n          tokenCountPrompt\n          tokenCountCompletion\n          input {\n            value\n          }\n          output {\n            value\n          }\n          context {\n            spanId\n            traceId\n          }\n          spanEvaluations {\n            name\n            label\n            score\n          }\n        }\n      }\n      cursor\n      node {\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment TracingHomePageHeader_stats on Query {\n  totalTraces: spans(rootSpansOnly: true) {\n    pageInfo {\n      totalCount\n    }\n  }\n  traceDatasetInfo {\n    startTime\n    endTime\n    tokenCountTotal\n    latencyMsP50\n    latencyMsP99\n  }\n}\n"
  }
};
})();

(node as any).hash = "8aad6a015e16f29da0b15ec83e06e396";

export default node;
