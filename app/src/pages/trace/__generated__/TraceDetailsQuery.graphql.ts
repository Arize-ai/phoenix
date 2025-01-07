/**
 * @generated SignedSource<<fa98e93e6d1dc991c0a0c017005caf51>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type AnnotatorKind = "HUMAN" | "LLM";
export type SpanKind = "agent" | "chain" | "embedding" | "evaluator" | "guardrail" | "llm" | "reranker" | "retriever" | "tool" | "unknown";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
export type TraceDetailsQuery$variables = {
  id: string;
  traceId: string;
};
export type TraceDetailsQuery$data = {
  readonly project: {
    readonly trace?: {
      readonly latencyMs: number | null;
      readonly projectSessionId: string | null;
      readonly spans: {
        readonly edges: ReadonlyArray<{
          readonly span: {
            readonly context: {
              readonly spanId: string;
              readonly traceId: string;
            };
            readonly id: string;
            readonly latencyMs: number | null;
            readonly name: string;
            readonly parentId: string | null;
            readonly spanAnnotations: ReadonlyArray<{
              readonly annotatorKind: AnnotatorKind;
              readonly id: string;
              readonly label: string | null;
              readonly name: string;
              readonly score: number | null;
            }>;
            readonly spanKind: SpanKind;
            readonly startTime: string;
            readonly statusCode: SpanStatusCode;
            readonly tokenCountCompletion: number | null;
            readonly tokenCountPrompt: number | null;
            readonly tokenCountTotal: number | null;
          };
        }>;
      };
    } | null;
  };
};
export type TraceDetailsQuery = {
  response: TraceDetailsQuery$data;
  variables: TraceDetailsQuery$variables;
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
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
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
  "name": "latencyMs",
  "storageKey": null
},
v6 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "traceId",
          "variableName": "traceId"
        }
      ],
      "concreteType": "Trace",
      "kind": "LinkedField",
      "name": "trace",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "projectSessionId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": [
            {
              "kind": "Literal",
              "name": "first",
              "value": 1000
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
                    {
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
                    (v4/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "spanKind",
                      "storageKey": null
                    },
                    {
                      "alias": "statusCode",
                      "args": null,
                      "kind": "ScalarField",
                      "name": "propagatedStatusCode",
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
                      "name": "parentId",
                      "storageKey": null
                    },
                    (v5/*: any*/),
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
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "SpanAnnotation",
                      "kind": "LinkedField",
                      "name": "spanAnnotations",
                      "plural": true,
                      "selections": [
                        (v3/*: any*/),
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
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "annotatorKind",
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
          "storageKey": "spans(first:1000)"
        },
        (v5/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "TraceDetailsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*: any*/)
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
    "name": "TraceDetailsQuery",
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
          (v6/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e49f79cc2ed4e3975425c66bfa0c9952",
    "id": null,
    "metadata": {},
    "name": "TraceDetailsQuery",
    "operationKind": "query",
    "text": "query TraceDetailsQuery(\n  $traceId: ID!\n  $id: GlobalID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      trace(traceId: $traceId) {\n        projectSessionId\n        spans(first: 1000) {\n          edges {\n            span: node {\n              id\n              context {\n                spanId\n                traceId\n              }\n              name\n              spanKind\n              statusCode: propagatedStatusCode\n              startTime\n              parentId\n              latencyMs\n              tokenCountTotal\n              tokenCountPrompt\n              tokenCountCompletion\n              spanAnnotations {\n                id\n                name\n                label\n                score\n                annotatorKind\n              }\n            }\n          }\n        }\n        latencyMs\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "5fb4b5eb8dbfa378e4e293ec414bb1aa";

export default node;
