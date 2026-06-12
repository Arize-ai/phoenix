/**
 * @generated SignedSource<<e7219cb1c5514ae26ef329af324b5ef2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type MimeType = "json" | "text";
export type SpanKind = "agent" | "chain" | "embedding" | "evaluator" | "guardrail" | "llm" | "prompt" | "reranker" | "retriever" | "tool" | "unknown";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
export type sessionPageContextTracesQuery$variables = {
  first?: number | null;
  id: string;
};
export type sessionPageContextTracesQuery$data = {
  readonly node: {
    readonly __typename: "ProjectSession";
    readonly id: string;
    readonly numTraces: number;
    readonly sessionId: string;
    readonly traces: {
      readonly edges: ReadonlyArray<{
        readonly trace: {
          readonly id: string;
          readonly rootSpan: {
            readonly cumulativeTokenCountTotal: number | null;
            readonly endTime: string | null;
            readonly id: string;
            readonly input: {
              readonly mimeType: MimeType;
              readonly truncatedValue: string;
              readonly value: string;
            } | null;
            readonly latencyMs: number | null;
            readonly name: string;
            readonly output: {
              readonly mimeType: MimeType;
              readonly truncatedValue: string;
              readonly value: string;
            } | null;
            readonly spanId: string;
            readonly spanKind: SpanKind;
            readonly startTime: string;
            readonly statusCode: SpanStatusCode;
            readonly trace: {
              readonly costSummary: {
                readonly total: {
                  readonly cost: number | null;
                };
              };
              readonly id: string;
            };
          } | null;
          readonly traceId: string;
        };
      }>;
      readonly pageInfo: {
        readonly endCursor: string | null;
        readonly hasNextPage: boolean;
      };
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type sessionPageContextTracesQuery = {
  response: sessionPageContextTracesQuery$data;
  variables: sessionPageContextTracesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": 10,
  "kind": "LocalArgument",
  "name": "first"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sessionId",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numTraces",
  "storageKey": null
},
v7 = [
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
    "name": "truncatedValue",
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
v8 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "first",
      "variableName": "first"
    }
  ],
  "concreteType": "TraceConnection",
  "kind": "LinkedField",
  "name": "traces",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "TraceEdge",
      "kind": "LinkedField",
      "name": "edges",
      "plural": true,
      "selections": [
        {
          "alias": "trace",
          "args": null,
          "concreteType": "Trace",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            (v4/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "traceId",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "Span",
              "kind": "LinkedField",
              "name": "rootSpan",
              "plural": false,
              "selections": [
                (v4/*: any*/),
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
                  "name": "name",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "spanKind",
                  "storageKey": null
                },
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
                  "name": "latencyMs",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "statusCode",
                  "storageKey": null
                },
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
                  "concreteType": "SpanIOValue",
                  "kind": "LinkedField",
                  "name": "input",
                  "plural": false,
                  "selections": (v7/*: any*/),
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "SpanIOValue",
                  "kind": "LinkedField",
                  "name": "output",
                  "plural": false,
                  "selections": (v7/*: any*/),
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Trace",
                  "kind": "LinkedField",
                  "name": "trace",
                  "plural": false,
                  "selections": [
                    (v4/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "SpanCostSummary",
                      "kind": "LinkedField",
                      "name": "costSummary",
                      "plural": false,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "CostBreakdown",
                          "kind": "LinkedField",
                          "name": "total",
                          "plural": false,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "cost",
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
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
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "sessionPageContextTracesQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v8/*: any*/)
            ],
            "type": "ProjectSession",
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
    "name": "sessionPageContextTracesQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v4/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*: any*/),
              (v6/*: any*/),
              (v8/*: any*/)
            ],
            "type": "ProjectSession",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "36cd8344b6fb057743fee1dfcc08887f",
    "id": null,
    "metadata": {},
    "name": "sessionPageContextTracesQuery",
    "operationKind": "query",
    "text": "query sessionPageContextTracesQuery(\n  $id: ID!\n  $first: Int = 10\n) {\n  node(id: $id) {\n    __typename\n    ... on ProjectSession {\n      id\n      sessionId\n      numTraces\n      traces(first: $first) {\n        edges {\n          trace: node {\n            id\n            traceId\n            rootSpan {\n              id\n              spanId\n              name\n              spanKind\n              startTime\n              endTime\n              latencyMs\n              statusCode\n              cumulativeTokenCountTotal\n              input {\n                value\n                truncatedValue\n                mimeType\n              }\n              output {\n                value\n                truncatedValue\n                mimeType\n              }\n              trace {\n                id\n                costSummary {\n                  total {\n                    cost\n                  }\n                }\n              }\n            }\n          }\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "8f54b78983d198a261ad9b8b8daf04bf";

export default node;
