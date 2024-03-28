/**
 * @generated SignedSource<<eb2038a99d492696e59f38990b598ad3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type MimeType = "json" | "text";
export type SpanKind = "agent" | "chain" | "embedding" | "llm" | "reranker" | "retriever" | "tool" | "unknown";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
export type TracePageQuery$variables = {
  id: string;
  traceId: string;
};
export type TracePageQuery$data = {
  readonly project: {
    readonly trace?: {
      readonly spans: {
        readonly edges: ReadonlyArray<{
          readonly span: {
            readonly attributes: string;
            readonly context: {
              readonly spanId: string;
            };
            readonly documentEvaluations: ReadonlyArray<{
              readonly documentPosition: number;
              readonly explanation: string | null;
              readonly label: string | null;
              readonly name: string;
              readonly score: number | null;
            }>;
            readonly documentRetrievalMetrics: ReadonlyArray<{
              readonly evaluationName: string;
              readonly hit: number | null;
              readonly ndcg: number | null;
              readonly precision: number | null;
            }>;
            readonly events: ReadonlyArray<{
              readonly message: string;
              readonly name: string;
              readonly timestamp: string;
            }>;
            readonly input: {
              readonly mimeType: MimeType;
              readonly value: string;
            } | null;
            readonly latencyMs: number | null;
            readonly name: string;
            readonly output: {
              readonly mimeType: MimeType;
              readonly value: string;
            } | null;
            readonly parentId: string | null;
            readonly spanEvaluations: ReadonlyArray<{
              readonly label: string | null;
              readonly name: string;
              readonly score: number | null;
            }>;
            readonly spanKind: SpanKind;
            readonly startTime: string;
            readonly statusCode: SpanStatusCode;
            readonly statusMessage: string;
            readonly tokenCountCompletion: number | null;
            readonly tokenCountPrompt: number | null;
            readonly tokenCountTotal: number | null;
            readonly " $fragmentSpreads": FragmentRefs<"SpanEvaluationsTable_evals">;
          };
        }>;
      };
    } | null;
  };
};
export type TracePageQuery = {
  response: TracePageQuery$data;
  variables: TracePageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "traceId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v3 = [
  {
    "kind": "Variable",
    "name": "traceId",
    "variableName": "traceId"
  }
],
v4 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 1000
  }
],
v5 = {
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
    }
  ],
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
  "name": "spanKind",
  "storageKey": null
},
v8 = {
  "alias": "statusCode",
  "args": null,
  "kind": "ScalarField",
  "name": "propagatedStatusCode",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "statusMessage",
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
  "name": "parentId",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokenCountTotal",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokenCountPrompt",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokenCountCompletion",
  "storageKey": null
},
v16 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "mimeType",
    "storageKey": null
  }
],
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v16/*: any*/),
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v16/*: any*/),
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "attributes",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanEvent",
  "kind": "LinkedField",
  "name": "events",
  "plural": true,
  "selections": [
    (v6/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "message",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "timestamp",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v23 = {
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
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "concreteType": "DocumentEvaluation",
  "kind": "LinkedField",
  "name": "documentEvaluations",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "documentPosition",
      "storageKey": null
    },
    (v6/*: any*/),
    (v21/*: any*/),
    (v22/*: any*/),
    (v24/*: any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "TracePageQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
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
                            "alias": "span",
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
                              (v10/*: any*/),
                              (v11/*: any*/),
                              (v12/*: any*/),
                              (v13/*: any*/),
                              (v14/*: any*/),
                              (v15/*: any*/),
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v19/*: any*/),
                              (v20/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanEvaluation",
                                "kind": "LinkedField",
                                "name": "spanEvaluations",
                                "plural": true,
                                "selections": [
                                  (v6/*: any*/),
                                  (v21/*: any*/),
                                  (v22/*: any*/)
                                ],
                                "storageKey": null
                              },
                              (v23/*: any*/),
                              (v25/*: any*/),
                              {
                                "args": null,
                                "kind": "FragmentSpread",
                                "name": "SpanEvaluationsTable_evals"
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": "spans(first:1000)"
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
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
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "TracePageQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v2/*: any*/),
        "concreteType": null,
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
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
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
                            "alias": "span",
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
                              (v10/*: any*/),
                              (v11/*: any*/),
                              (v12/*: any*/),
                              (v13/*: any*/),
                              (v14/*: any*/),
                              (v15/*: any*/),
                              (v17/*: any*/),
                              (v18/*: any*/),
                              (v19/*: any*/),
                              (v20/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanEvaluation",
                                "kind": "LinkedField",
                                "name": "spanEvaluations",
                                "plural": true,
                                "selections": [
                                  (v6/*: any*/),
                                  (v21/*: any*/),
                                  (v22/*: any*/),
                                  (v24/*: any*/)
                                ],
                                "storageKey": null
                              },
                              (v23/*: any*/),
                              (v25/*: any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": "spans(first:1000)"
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
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
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3086b780c690895d7bd37d03dec6d4a5",
    "id": null,
    "metadata": {},
    "name": "TracePageQuery",
    "operationKind": "query",
    "text": "query TracePageQuery(\n  $traceId: ID!\n  $id: GlobalID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      trace(traceId: $traceId) {\n        spans(first: 1000) {\n          edges {\n            span: node {\n              context {\n                spanId\n              }\n              name\n              spanKind\n              statusCode: propagatedStatusCode\n              statusMessage\n              startTime\n              parentId\n              latencyMs\n              tokenCountTotal\n              tokenCountPrompt\n              tokenCountCompletion\n              input {\n                value\n                mimeType\n              }\n              output {\n                value\n                mimeType\n              }\n              attributes\n              events {\n                name\n                message\n                timestamp\n              }\n              spanEvaluations {\n                name\n                label\n                score\n              }\n              documentRetrievalMetrics {\n                evaluationName\n                ndcg\n                precision\n                hit\n              }\n              documentEvaluations {\n                documentPosition\n                name\n                label\n                score\n                explanation\n              }\n              ...SpanEvaluationsTable_evals\n            }\n          }\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n\nfragment SpanEvaluationsTable_evals on Span {\n  spanEvaluations {\n    name\n    label\n    score\n    explanation\n  }\n}\n"
  }
};
})();

(node as any).hash = "4975ac3e59a296d71492d7cee3aee2ea";

export default node;
