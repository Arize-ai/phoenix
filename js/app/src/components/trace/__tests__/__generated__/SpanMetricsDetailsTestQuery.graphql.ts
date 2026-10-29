/**
 * @generated SignedSource<<482f41096ee0e6be50c3ecfe049a41a6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanMetricsDetailsTestQuery$variables = Record<PropertyKey, never>;
export type SpanMetricsDetailsTestQuery$data = {
  readonly span: {
    readonly " $fragmentSpreads": FragmentRefs<"SpanMetricsDetails_span">;
  };
};
export type SpanMetricsDetailsTestQuery = {
  response: SpanMetricsDetailsTestQuery$data;
  variables: SpanMetricsDetailsTestQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "id",
    "value": "test-span-id"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v2 = [
  (v1/*:: as any*/)
],
v3 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "String"
},
v4 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "CostBreakdown"
},
v5 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "Float"
},
v6 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "Int"
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanMetricsDetailsTestQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v0/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
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
        "storageKey": "node(id:\"test-span-id\")"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SpanMetricsDetailsTestQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v0/*:: as any*/),
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
                    "selections": (v2/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "CostBreakdown",
                    "kind": "LinkedField",
                    "name": "prompt",
                    "plural": false,
                    "selections": (v2/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "CostBreakdown",
                    "kind": "LinkedField",
                    "name": "completion",
                    "plural": false,
                    "selections": (v2/*:: as any*/),
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
                      (v1/*:: as any*/),
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": "node(id:\"test-span-id\")"
      }
    ]
  },
  "params": {
    "cacheID": "42bbfa3ab14d6d6938ab5e5737e627b2",
    "id": null,
    "metadata": {
      "relayTestingSelectionTypeInfo": {
        "span": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Node"
        },
        "span.__typename": (v3/*:: as any*/),
        "span.costDetailSummaryEntries": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "SpanCostDetailSummaryEntry"
        },
        "span.costDetailSummaryEntries.isPrompt": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Boolean"
        },
        "span.costDetailSummaryEntries.tokenType": (v3/*:: as any*/),
        "span.costDetailSummaryEntries.value": (v4/*:: as any*/),
        "span.costDetailSummaryEntries.value.cost": (v5/*:: as any*/),
        "span.costDetailSummaryEntries.value.tokens": (v5/*:: as any*/),
        "span.costSummary": {
          "enumValues": null,
          "nullable": true,
          "plural": false,
          "type": "SpanCostSummary"
        },
        "span.costSummary.completion": (v4/*:: as any*/),
        "span.costSummary.completion.cost": (v5/*:: as any*/),
        "span.costSummary.prompt": (v4/*:: as any*/),
        "span.costSummary.prompt.cost": (v5/*:: as any*/),
        "span.costSummary.total": (v4/*:: as any*/),
        "span.costSummary.total.cost": (v5/*:: as any*/),
        "span.id": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "ID"
        },
        "span.tokenCountCompletion": (v6/*:: as any*/),
        "span.tokenCountPrompt": (v6/*:: as any*/),
        "span.tokenCountTotal": (v6/*:: as any*/)
      }
    },
    "name": "SpanMetricsDetailsTestQuery",
    "operationKind": "query",
    "text": "query SpanMetricsDetailsTestQuery {\n  span: node(id: \"test-span-id\") {\n    __typename\n    ... on Span {\n      ...SpanMetricsDetails_span\n    }\n    id\n  }\n}\n\nfragment SpanMetricsDetails_span on Span {\n  tokenCountTotal\n  tokenCountPrompt\n  tokenCountCompletion\n  costSummary {\n    total {\n      cost\n    }\n    prompt {\n      cost\n    }\n    completion {\n      cost\n    }\n  }\n  costDetailSummaryEntries {\n    tokenType\n    isPrompt\n    value {\n      cost\n      tokens\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2e54c92e1e96b69ae047655584a09c00";

export default node;
