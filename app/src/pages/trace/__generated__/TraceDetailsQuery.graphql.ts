/**
 * @generated SignedSource<<37ed0d55df8fad12264b6e221fe4213b>>
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
      readonly costSummary: {
        readonly completion: {
          readonly cost: number | null;
        };
        readonly prompt: {
          readonly cost: number | null;
        };
        readonly total: {
          readonly cost: number | null;
        };
      };
      readonly latencyMs: number | null;
      readonly projectSessionId: string | null;
      readonly spans: {
        readonly edges: ReadonlyArray<{
          readonly span: {
            readonly id: string;
            readonly latencyMs: number | null;
            readonly name: string;
            readonly parentId: string | null;
            readonly spanAnnotationSummaries: ReadonlyArray<{
              readonly count: number;
              readonly labelCount: number;
              readonly labelFractions: ReadonlyArray<{
                readonly fraction: number;
                readonly label: string;
              }>;
              readonly labels: ReadonlyArray<string>;
              readonly meanScore: number | null;
              readonly name: string;
              readonly scoreCount: number;
            }>;
            readonly spanId: string;
            readonly spanKind: SpanKind;
            readonly startTime: string;
            readonly statusCode: SpanStatusCode;
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
v3 = [
  {
    "kind": "Variable",
    "name": "traceId",
    "variableName": "traceId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectSessionId",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
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
  "name": "latencyMs",
  "storageKey": null
},
v8 = {
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
            (v5/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "spanId",
              "storageKey": null
            },
            (v6/*: any*/),
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
            (v7/*: any*/),
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
              "concreteType": "AnnotationSummary",
              "kind": "LinkedField",
              "name": "spanAnnotationSummaries",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "labels",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "count",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "labelCount",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "LabelFraction",
                  "kind": "LinkedField",
                  "name": "labelFractions",
                  "plural": true,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "fraction",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "label",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                },
                (v6/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "scoreCount",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "meanScore",
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
v9 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v10 = {
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
      "name": "prompt",
      "plural": false,
      "selections": (v9/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "completion",
      "plural": false,
      "selections": (v9/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "total",
      "plural": false,
      "selections": (v9/*: any*/),
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
                  (v4/*: any*/),
                  (v8/*: any*/),
                  (v7/*: any*/),
                  (v10/*: any*/)
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
                  (v4/*: any*/),
                  (v8/*: any*/),
                  (v7/*: any*/),
                  (v10/*: any*/),
                  (v5/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
          (v5/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "11ead68138be33327972520ed0a0ea09",
    "id": null,
    "metadata": {},
    "name": "TraceDetailsQuery",
    "operationKind": "query",
    "text": "query TraceDetailsQuery(\n  $traceId: ID!\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      trace(traceId: $traceId) {\n        projectSessionId\n        spans(first: 1000) {\n          edges {\n            span: node {\n              id\n              spanId\n              name\n              spanKind\n              statusCode\n              startTime\n              parentId\n              latencyMs\n              tokenCountTotal\n              spanAnnotationSummaries {\n                labels\n                count\n                labelCount\n                labelFractions {\n                  fraction\n                  label\n                }\n                name\n                scoreCount\n                meanScore\n              }\n            }\n          }\n        }\n        latencyMs\n        costSummary {\n          prompt {\n            cost\n          }\n          completion {\n            cost\n          }\n          total {\n            cost\n          }\n        }\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "2c97785cc9a789cbebe59a993e72529d";

export default node;
