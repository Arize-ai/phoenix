/**
 * @generated SignedSource<<c7baa729223f2f2abc4061b7792b3749>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanKind = "agent" | "chain" | "embedding" | "evaluator" | "guardrail" | "llm" | "prompt" | "reranker" | "retriever" | "tool" | "unknown";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
export type SpanDetailsHeaderQuery$variables = {
  id: string;
  includeSession: boolean;
};
export type SpanDetailsHeaderQuery$data = {
  readonly span: {
    readonly __typename: "Span";
    readonly id: string;
    readonly spanId: string;
    readonly spanKind: SpanKind;
    readonly trace: {
      readonly costSummary: {
        readonly total: {
          readonly cost: number | null;
        };
      };
      readonly id: string;
      readonly latencyMs: number | null;
      readonly rootSpan: {
        readonly cumulativeTokenCountTotal: number | null;
        readonly statusCode: SpanStatusCode;
      } | null;
      readonly session?: {
        readonly costSummary: {
          readonly total: {
            readonly cost: number | null;
          };
        };
        readonly id: string;
        readonly sessionId: string;
        readonly tokenUsage: {
          readonly total: number;
        };
      } | null;
      readonly startTime: string;
      readonly traceId: string;
    };
    readonly " $fragmentSpreads": FragmentRefs<"SpanHeader_span">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type SpanDetailsHeaderQuery = {
  response: SpanDetailsHeaderQuery$data;
  variables: SpanDetailsHeaderQuery$variables;
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
    "name": "includeSession"
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
  "name": "spanId",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v8 = {
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
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "statusCode",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cumulativeTokenCountTotal",
  "storageKey": null
},
v11 = {
  "condition": "includeSession",
  "kind": "Condition",
  "passingValue": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ProjectSession",
      "kind": "LinkedField",
      "name": "session",
      "plural": false,
      "selections": [
        (v3/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "sessionId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "TokenUsage",
          "kind": "LinkedField",
          "name": "tokenUsage",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "total",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        (v8/*:: as any*/)
      ],
      "storageKey": null
    }
  ]
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanDetailsHeaderQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v7/*:: as any*/),
                  (v8/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Span",
                    "kind": "LinkedField",
                    "name": "rootSpan",
                    "plural": false,
                    "selections": [
                      (v9/*:: as any*/),
                      (v10/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v11/*:: as any*/)
                ],
                "storageKey": null
              },
              (v12/*:: as any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "SpanHeader_span"
              }
            ],
            "type": "Span",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SpanDetailsHeaderQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v7/*:: as any*/),
                  (v8/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Span",
                    "kind": "LinkedField",
                    "name": "rootSpan",
                    "plural": false,
                    "selections": [
                      (v9/*:: as any*/),
                      (v10/*:: as any*/),
                      (v3/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v11/*:: as any*/)
                ],
                "storageKey": null
              },
              (v12/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
              },
              {
                "alias": "code",
                "args": null,
                "kind": "ScalarField",
                "name": "statusCode",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "statusMessage",
                "storageKey": null
              },
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "tokenCountTotal",
                "storageKey": null
              },
              (v8/*:: as any*/)
            ],
            "type": "Span",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f2efa88fef75d42c21ebe02677171b98",
    "id": null,
    "metadata": {},
    "name": "SpanDetailsHeaderQuery",
    "operationKind": "query",
    "text": "query SpanDetailsHeaderQuery(\n  $id: ID!\n  $includeSession: Boolean!\n) {\n  span: node(id: $id) {\n    __typename\n    ... on Span {\n      id\n      spanId\n      trace {\n        id\n        traceId\n        latencyMs\n        startTime\n        costSummary {\n          total {\n            cost\n          }\n        }\n        rootSpan {\n          statusCode\n          cumulativeTokenCountTotal\n          id\n        }\n        session @include(if: $includeSession) {\n          id\n          sessionId\n          tokenUsage {\n            total\n          }\n          costSummary {\n            total {\n              cost\n            }\n          }\n        }\n      }\n      spanKind\n      ...SpanHeader_span\n    }\n    id\n  }\n}\n\nfragment SpanHeader_span on Span {\n  id\n  name\n  spanKind\n  spanId\n  code: statusCode\n  statusMessage\n  latencyMs\n  startTime\n  tokenCountTotal\n  costSummary {\n    total {\n      cost\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5baabf46f240954bda379650cd5b4ed3";

export default node;
