/**
 * @generated SignedSource<<fdf35ee84a29bc512279942e1a9a278c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SessionTurnPreviewTooltipUsageQuery$variables = {
  traceNodeId: string;
};
export type SessionTurnPreviewTooltipUsageQuery$data = {
  readonly node: {
    readonly __typename: "Trace";
    readonly costDetailSummaryEntries: ReadonlyArray<{
      readonly isPrompt: boolean;
      readonly tokenType: string;
      readonly value: {
        readonly cost: number | null;
      };
    }>;
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
    readonly rootSpan: {
      readonly cumulativeCostDetailSummaryEntries: ReadonlyArray<{
        readonly isPrompt: boolean;
        readonly tokenType: string;
        readonly value: {
          readonly tokens: number | null;
        };
      }>;
      readonly cumulativeTokenCountCompletion: number | null;
      readonly cumulativeTokenCountPrompt: number | null;
      readonly cumulativeTokenCountTotal: number | null;
    } | null;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type SessionTurnPreviewTooltipUsageQuery = {
  response: SessionTurnPreviewTooltipUsageQuery$data;
  variables: SessionTurnPreviewTooltipUsageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "traceNodeId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "traceNodeId"
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
  "name": "cumulativeTokenCountTotal",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cumulativeTokenCountPrompt",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cumulativeTokenCountCompletion",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokenType",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isPrompt",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanCostDetailSummaryEntry",
  "kind": "LinkedField",
  "name": "cumulativeCostDetailSummaryEntries",
  "plural": true,
  "selections": [
    (v6/*:: as any*/),
    (v7/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "value",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "tokens",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
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
      "name": "total",
      "plural": false,
      "selections": (v9/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "prompt",
      "plural": false,
      "selections": (v9/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "completion",
      "plural": false,
      "selections": (v9/*:: as any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanCostDetailSummaryEntry",
  "kind": "LinkedField",
  "name": "costDetailSummaryEntries",
  "plural": true,
  "selections": [
    (v6/*:: as any*/),
    (v7/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "value",
      "plural": false,
      "selections": (v9/*:: as any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionTurnPreviewTooltipUsageQuery",
    "selections": [
      {
        "alias": null,
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
              {
                "alias": null,
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "rootSpan",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v8/*:: as any*/)
                ],
                "storageKey": null
              },
              (v10/*:: as any*/),
              (v11/*:: as any*/)
            ],
            "type": "Trace",
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
    "name": "SessionTurnPreviewTooltipUsageQuery",
    "selections": [
      {
        "alias": null,
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
              {
                "alias": null,
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "rootSpan",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v8/*:: as any*/),
                  (v12/*:: as any*/)
                ],
                "storageKey": null
              },
              (v10/*:: as any*/),
              (v11/*:: as any*/)
            ],
            "type": "Trace",
            "abstractKey": null
          },
          (v12/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "cbbc5a5098236ff068c9b07844111d24",
    "id": null,
    "metadata": {},
    "name": "SessionTurnPreviewTooltipUsageQuery",
    "operationKind": "query",
    "text": "query SessionTurnPreviewTooltipUsageQuery(\n  $traceNodeId: ID!\n) {\n  node(id: $traceNodeId) {\n    __typename\n    ... on Trace {\n      rootSpan {\n        cumulativeTokenCountTotal\n        cumulativeTokenCountPrompt\n        cumulativeTokenCountCompletion\n        cumulativeCostDetailSummaryEntries {\n          tokenType\n          isPrompt\n          value {\n            tokens\n          }\n        }\n        id\n      }\n      costSummary {\n        total {\n          cost\n        }\n        prompt {\n          cost\n        }\n        completion {\n          cost\n        }\n      }\n      costDetailSummaryEntries {\n        tokenType\n        isPrompt\n        value {\n          cost\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "1699565fd8ab901268cfb7ea26bc6456";

export default node;
