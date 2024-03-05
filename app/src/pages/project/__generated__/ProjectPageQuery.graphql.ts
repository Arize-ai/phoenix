/**
 * @generated SignedSource<<9236cf675eaa4bef01f51f75efc64a4b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageQuery$variables = {};
export type ProjectPageQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ProjectPageHeader_stats" | "SpansTable_spans" | "StreamToggle_data" | "TracesTable_spans">;
};
export type ProjectPageQuery = {
  response: ProjectPageQuery$data;
  variables: ProjectPageQuery$variables;
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
  "name": "metadata",
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
  "concreteType": "DocumentRetrievalMetrics",
  "kind": "LinkedField",
  "name": "documentRetrievalMetrics",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "ndcg",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "precision",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hit",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v17 = {
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
v18 = {
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
v19 = {
  "kind": "Literal",
  "name": "rootSpansOnly",
  "value": true
},
v20 = [
  (v0/*: any*/),
  (v19/*: any*/),
  (v1/*: any*/)
],
v21 = {
  "alias": "statusCode",
  "args": null,
  "kind": "ScalarField",
  "name": "propagatedStatusCode",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v23 = [
  (v12/*: any*/)
],
v24 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v23/*: any*/),
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v23/*: any*/),
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectPageQuery",
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
        "name": "ProjectPageHeader_stats"
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
    "name": "ProjectPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "spanEvaluationNames",
        "storageKey": null
      },
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
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "statusCode",
                    "storageKey": null
                  },
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
                  (v14/*: any*/),
                  (v15/*: any*/)
                ],
                "storageKey": null
              },
              (v16/*: any*/),
              (v17/*: any*/)
            ],
            "storageKey": null
          },
          (v18/*: any*/)
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
        "args": (v20/*: any*/),
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
                  (v21/*: any*/),
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
                  (v22/*: any*/),
                  (v24/*: any*/),
                  (v25/*: any*/),
                  (v11/*: any*/),
                  (v14/*: any*/),
                  (v15/*: any*/),
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
                      (v21/*: any*/),
                      (v6/*: any*/),
                      (v7/*: any*/),
                      (v22/*: any*/),
                      (v8/*: any*/),
                      (v9/*: any*/),
                      (v10/*: any*/),
                      (v24/*: any*/),
                      (v25/*: any*/),
                      (v11/*: any*/),
                      (v14/*: any*/),
                      (v15/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v16/*: any*/),
              (v17/*: any*/)
            ],
            "storageKey": null
          },
          (v18/*: any*/)
        ],
        "storageKey": "spans(first:100,rootSpansOnly:true,sort:{\"col\":\"startTime\",\"dir\":\"desc\"})"
      },
      {
        "alias": "rootSpans",
        "args": (v20/*: any*/),
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
        "args": [
          (v19/*: any*/)
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
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "documentEvaluationNames",
        "storageKey": null
      },
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
    "cacheID": "fa771421582c8644c19005e9b3fe5561",
    "id": null,
    "metadata": {},
    "name": "ProjectPageQuery",
    "operationKind": "query",
    "text": "query ProjectPageQuery {\n  ...SpansTable_spans\n  ...TracesTable_spans\n  ...ProjectPageHeader_stats\n  ...StreamToggle_data\n}\n\nfragment ProjectPageHeader_stats on Query {\n  totalTraces: spans(rootSpansOnly: true) {\n    pageInfo {\n      totalCount\n    }\n  }\n  traceDatasetInfo {\n    startTime\n    endTime\n    tokenCountTotal\n    latencyMsP50\n    latencyMsP99\n  }\n  spanEvaluationNames\n  documentEvaluationNames\n}\n\nfragment SpanColumnSelector_evaluations on Query {\n  spanEvaluationNames\n}\n\nfragment SpansTable_spans on Query {\n  ...SpanColumnSelector_evaluations\n  spans(first: 100, sort: {col: startTime, dir: desc}) {\n    edges {\n      span: node {\n        spanKind\n        name\n        metadata\n        statusCode\n        startTime\n        latencyMs\n        tokenCountTotal\n        tokenCountPrompt\n        tokenCountCompletion\n        context {\n          spanId\n          traceId\n        }\n        input {\n          value\n          mimeType\n        }\n        output {\n          value\n          mimeType\n        }\n        spanEvaluations {\n          name\n          label\n          score\n        }\n        documentRetrievalMetrics {\n          evaluationName\n          ndcg\n          precision\n          hit\n        }\n      }\n      cursor\n      node {\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment StreamToggle_data on Query {\n  streamingLastUpdatedAt\n}\n\nfragment TracesTable_spans on Query {\n  ...SpanColumnSelector_evaluations\n  rootSpans: spans(first: 100, sort: {col: startTime, dir: desc}, rootSpansOnly: true) {\n    edges {\n      rootSpan: node {\n        spanKind\n        name\n        metadata\n        statusCode: propagatedStatusCode\n        startTime\n        latencyMs\n        tokenCountTotal: cumulativeTokenCountTotal\n        tokenCountPrompt: cumulativeTokenCountPrompt\n        tokenCountCompletion: cumulativeTokenCountCompletion\n        parentId\n        input {\n          value\n        }\n        output {\n          value\n        }\n        context {\n          spanId\n          traceId\n        }\n        spanEvaluations {\n          name\n          label\n          score\n        }\n        documentRetrievalMetrics {\n          evaluationName\n          ndcg\n          precision\n          hit\n        }\n        descendants {\n          spanKind\n          name\n          statusCode: propagatedStatusCode\n          startTime\n          latencyMs\n          parentId\n          tokenCountTotal\n          tokenCountPrompt\n          tokenCountCompletion\n          input {\n            value\n          }\n          output {\n            value\n          }\n          context {\n            spanId\n            traceId\n          }\n          spanEvaluations {\n            name\n            label\n            score\n          }\n          documentRetrievalMetrics {\n            evaluationName\n            ndcg\n            precision\n            hit\n          }\n        }\n      }\n      cursor\n      node {\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "885d9dfdd010c8a7d10789304a17a15b";

export default node;
