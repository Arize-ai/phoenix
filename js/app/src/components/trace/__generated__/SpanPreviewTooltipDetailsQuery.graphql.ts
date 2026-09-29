/**
 * @generated SignedSource<<58d5f4ca9533db0c960f0556166fcbc7>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanPreviewTooltipDetailsQuery$variables = {
  nodeId: string;
};
export type SpanPreviewTooltipDetailsQuery$data = {
  readonly node: {
    readonly __typename: "Span";
    readonly previewSpanAnnotations: ReadonlyArray<{
      readonly createdAt: string;
      readonly explanation: string | null;
      readonly id: string;
      readonly name: string;
    }>;
    readonly " $fragmentSpreads": FragmentRefs<"SpanMetricsDetails_span">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type SpanPreviewTooltipDetailsQuery = {
  response: SpanPreviewTooltipDetailsQuery$data;
  variables: SpanPreviewTooltipDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "nodeId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "nodeId"
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
  "alias": "previewSpanAnnotations",
  "args": [
    {
      "kind": "Literal",
      "name": "filter",
      "value": {
        "exclude": {
          "names": [
            "note"
          ]
        }
      }
    }
  ],
  "concreteType": "SpanAnnotation",
  "kind": "LinkedField",
  "name": "spanAnnotations",
  "plural": true,
  "selections": [
    (v3/*:: as any*/),
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
      "name": "explanation",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "createdAt",
      "storageKey": null
    }
  ],
  "storageKey": "spanAnnotations(filter:{\"exclude\":{\"names\":[\"note\"]}})"
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v6 = [
  (v5/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanPreviewTooltipDetailsQuery",
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
              (v4/*:: as any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "SpanMetricsDetails_span"
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
    "name": "SpanPreviewTooltipDetailsQuery",
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
              (v4/*:: as any*/),
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
                    "selections": (v6/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "CostBreakdown",
                    "kind": "LinkedField",
                    "name": "prompt",
                    "plural": false,
                    "selections": (v6/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "CostBreakdown",
                    "kind": "LinkedField",
                    "name": "completion",
                    "plural": false,
                    "selections": (v6/*:: as any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "SpanCostDetailSummaryEntry",
                "kind": "LinkedField",
                "name": "costDetailSummaryEntries",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "tokenType",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "isPrompt",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "CostBreakdown",
                    "kind": "LinkedField",
                    "name": "value",
                    "plural": false,
                    "selections": [
                      (v5/*:: as any*/),
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
              }
            ],
            "type": "Span",
            "abstractKey": null
          },
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ddc4ebe0d7788e1c44561077e19571c9",
    "id": null,
    "metadata": {},
    "name": "SpanPreviewTooltipDetailsQuery",
    "operationKind": "query",
    "text": "query SpanPreviewTooltipDetailsQuery(\n  $nodeId: ID!\n) {\n  node(id: $nodeId) {\n    __typename\n    ... on Span {\n      previewSpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}}) {\n        id\n        name\n        explanation\n        createdAt\n      }\n      ...SpanMetricsDetails_span\n    }\n    id\n  }\n}\n\nfragment SpanMetricsDetails_span on Span {\n  tokenCountTotal\n  tokenCountPrompt\n  tokenCountCompletion\n  costSummary {\n    total {\n      cost\n    }\n    prompt {\n      cost\n    }\n    completion {\n      cost\n    }\n  }\n  costDetailSummaryEntries {\n    tokenType\n    isPrompt\n    value {\n      cost\n      tokens\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "105a1707c71f1383d790f808c725793f";

export default node;
