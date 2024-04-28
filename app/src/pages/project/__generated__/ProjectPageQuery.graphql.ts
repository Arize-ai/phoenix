/**
 * @generated SignedSource<<ffd727bca8184286f516f34076d89808>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TimeRange = {
  end: string;
  start: string;
};
export type ProjectPageQuery$variables = {
  id: string;
  timeRange: TimeRange;
};
export type ProjectPageQuery$data = {
  readonly project: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectPageHeader_stats" | "SpansTable_spans" | "StreamToggle_data" | "TracesTable_spans">;
  };
};
export type ProjectPageQuery = {
  response: ProjectPageQuery$data;
  variables: ProjectPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "timeRange"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "kind": "Literal",
  "name": "first",
  "value": 100
},
v4 = {
  "kind": "Literal",
  "name": "sort",
  "value": {
    "col": "startTime",
    "dir": "desc"
  }
},
v5 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v6 = [
  (v3/*: any*/),
  (v4/*: any*/),
  (v5/*: any*/)
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v12 = {
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
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v14 = [
  (v13/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "mimeType",
    "storageKey": null
  }
],
v15 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanEvaluation",
  "kind": "LinkedField",
  "name": "spanEvaluations",
  "plural": true,
  "selections": [
    (v8/*: any*/),
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
v16 = {
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
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "concreteType": "Span",
  "kind": "LinkedField",
  "name": "node",
  "plural": false,
  "selections": [
    (v2/*: any*/)
  ],
  "storageKey": null
},
v19 = {
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
v20 = [
  (v3/*: any*/),
  {
    "kind": "Literal",
    "name": "rootSpansOnly",
    "value": true
  },
  (v4/*: any*/),
  (v5/*: any*/)
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
  (v13/*: any*/)
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
},
v26 = [
  (v5/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectPageQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
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
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectPageQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
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
                "args": (v6/*: any*/),
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
                          (v7/*: any*/),
                          (v8/*: any*/),
                          (v9/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "statusCode",
                            "storageKey": null
                          },
                          (v10/*: any*/),
                          (v11/*: any*/),
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
                            "name": "tokenCountPrompt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "tokenCountCompletion",
                            "storageKey": null
                          },
                          (v12/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SpanIOValue",
                            "kind": "LinkedField",
                            "name": "input",
                            "plural": false,
                            "selections": (v14/*: any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SpanIOValue",
                            "kind": "LinkedField",
                            "name": "output",
                            "plural": false,
                            "selections": (v14/*: any*/),
                            "storageKey": null
                          },
                          (v15/*: any*/),
                          (v16/*: any*/)
                        ],
                        "storageKey": null
                      },
                      (v17/*: any*/),
                      (v18/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v19/*: any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v6/*: any*/),
                "filters": [
                  "sort",
                  "filterCondition",
                  "timeRange"
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
                          (v7/*: any*/),
                          (v8/*: any*/),
                          (v9/*: any*/),
                          (v21/*: any*/),
                          (v10/*: any*/),
                          (v11/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "cumulativeTokenCountTotal",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "cumulativeTokenCountPrompt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "cumulativeTokenCountCompletion",
                            "storageKey": null
                          },
                          (v22/*: any*/),
                          (v24/*: any*/),
                          (v25/*: any*/),
                          (v12/*: any*/),
                          (v15/*: any*/),
                          (v16/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Span",
                            "kind": "LinkedField",
                            "name": "descendants",
                            "plural": true,
                            "selections": [
                              (v7/*: any*/),
                              (v8/*: any*/),
                              (v21/*: any*/),
                              (v10/*: any*/),
                              (v11/*: any*/),
                              (v22/*: any*/),
                              {
                                "alias": "cumulativeTokenCountTotal",
                                "args": null,
                                "kind": "ScalarField",
                                "name": "tokenCountTotal",
                                "storageKey": null
                              },
                              {
                                "alias": "cumulativeTokenCountPrompt",
                                "args": null,
                                "kind": "ScalarField",
                                "name": "tokenCountPrompt",
                                "storageKey": null
                              },
                              {
                                "alias": "cumulativeTokenCountCompletion",
                                "args": null,
                                "kind": "ScalarField",
                                "name": "tokenCountCompletion",
                                "storageKey": null
                              },
                              (v24/*: any*/),
                              (v25/*: any*/),
                              (v12/*: any*/),
                              (v15/*: any*/),
                              (v16/*: any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      (v17/*: any*/),
                      (v18/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v19/*: any*/)
                ],
                "storageKey": null
              },
              {
                "alias": "rootSpans",
                "args": (v20/*: any*/),
                "filters": [
                  "sort",
                  "rootSpansOnly",
                  "filterCondition",
                  "timeRange"
                ],
                "handle": "connection",
                "key": "TracesTable_rootSpans",
                "kind": "LinkedHandle",
                "name": "spans"
              },
              {
                "alias": null,
                "args": (v26/*: any*/),
                "kind": "ScalarField",
                "name": "traceCount",
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v26/*: any*/),
                "kind": "ScalarField",
                "name": "tokenCountTotal",
                "storageKey": null
              },
              {
                "alias": "latencyMsP50",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "probability",
                    "value": 0.5
                  },
                  (v5/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "latencyMsQuantile",
                "storageKey": null
              },
              {
                "alias": "latencyMsP99",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "probability",
                    "value": 0.99
                  },
                  (v5/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "latencyMsQuantile",
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
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f8f5e548466fd3bfb987e04ef8fce0a8",
    "id": null,
    "metadata": {},
    "name": "ProjectPageQuery",
    "operationKind": "query",
    "text": "query ProjectPageQuery(\n  $id: GlobalID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $id) {\n    __typename\n    ...SpansTable_spans\n    ...TracesTable_spans\n    ...ProjectPageHeader_stats\n    ...StreamToggle_data\n    __isNode: __typename\n    id\n  }\n}\n\nfragment ProjectPageHeader_stats on Project {\n  traceCount(timeRange: $timeRange)\n  tokenCountTotal(timeRange: $timeRange)\n  latencyMsP50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange)\n  latencyMsP99: latencyMsQuantile(probability: 0.99, timeRange: $timeRange)\n  spanEvaluationNames\n  documentEvaluationNames\n  id\n}\n\nfragment SpanColumnSelector_evaluations on Project {\n  spanEvaluationNames\n}\n\nfragment SpansTable_spans on Project {\n  ...SpanColumnSelector_evaluations\n  spans(first: 100, sort: {col: startTime, dir: desc}, timeRange: $timeRange) {\n    edges {\n      span: node {\n        spanKind\n        name\n        metadata\n        statusCode\n        startTime\n        latencyMs\n        tokenCountTotal\n        tokenCountPrompt\n        tokenCountCompletion\n        context {\n          spanId\n          traceId\n        }\n        input {\n          value\n          mimeType\n        }\n        output {\n          value\n          mimeType\n        }\n        spanEvaluations {\n          name\n          label\n          score\n        }\n        documentRetrievalMetrics {\n          evaluationName\n          ndcg\n          precision\n          hit\n        }\n      }\n      cursor\n      node {\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment StreamToggle_data on Project {\n  streamingLastUpdatedAt\n  id\n}\n\nfragment TracesTable_spans on Project {\n  ...SpanColumnSelector_evaluations\n  rootSpans: spans(first: 100, sort: {col: startTime, dir: desc}, rootSpansOnly: true, timeRange: $timeRange) {\n    edges {\n      rootSpan: node {\n        spanKind\n        name\n        metadata\n        statusCode: propagatedStatusCode\n        startTime\n        latencyMs\n        cumulativeTokenCountTotal\n        cumulativeTokenCountPrompt\n        cumulativeTokenCountCompletion\n        parentId\n        input {\n          value\n        }\n        output {\n          value\n        }\n        context {\n          spanId\n          traceId\n        }\n        spanEvaluations {\n          name\n          label\n          score\n        }\n        documentRetrievalMetrics {\n          evaluationName\n          ndcg\n          precision\n          hit\n        }\n        descendants {\n          spanKind\n          name\n          statusCode: propagatedStatusCode\n          startTime\n          latencyMs\n          parentId\n          cumulativeTokenCountTotal: tokenCountTotal\n          cumulativeTokenCountPrompt: tokenCountPrompt\n          cumulativeTokenCountCompletion: tokenCountCompletion\n          input {\n            value\n          }\n          output {\n            value\n          }\n          context {\n            spanId\n            traceId\n          }\n          spanEvaluations {\n            name\n            label\n            score\n          }\n          documentRetrievalMetrics {\n            evaluationName\n            ndcg\n            precision\n            hit\n          }\n        }\n      }\n      cursor\n      node {\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "c1b22588515ba56f88b7ea8ed8bb12fa";

export default node;
