/**
 * @generated SignedSource<<df97ed52d30faec0fd773ea26b0c0bee>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
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
            readonly id: string;
            readonly latencyMs: number | null;
            readonly name: string;
            readonly parentId: string | null;
            readonly spanId: string;
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
  "name": "latencyMs",
  "storageKey": null
},
v5 = {
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
                      "name": "statusCode",
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
                    (v4/*: any*/),
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
        (v4/*: any*/)
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
          (v5/*: any*/)
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
          (v5/*: any*/),
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
    "cacheID": "9434c8c6e07d5ca4dd3a19286644f369",
    "id": null,
    "metadata": {},
    "name": "TraceDetailsQuery",
    "operationKind": "query",
    "text": "query TraceDetailsQuery(\n  $traceId: ID!\n  $id: GlobalID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      trace(traceId: $traceId) {\n        projectSessionId\n        spans(first: 1000) {\n          edges {\n            span: node {\n              id\n              spanId\n              name\n              spanKind\n              statusCode\n              startTime\n              parentId\n              latencyMs\n              tokenCountTotal\n              tokenCountPrompt\n              tokenCountCompletion\n            }\n          }\n        }\n        latencyMs\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e4165ac98e972c7c7491e1573a1aec1a";

export default node;
