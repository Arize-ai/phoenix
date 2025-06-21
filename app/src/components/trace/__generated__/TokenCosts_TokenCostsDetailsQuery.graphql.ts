/**
 * @generated SignedSource<<c67092f73558bbc51bb72f7994731eea>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TokenCosts_TokenCostsDetailsQuery$variables = {
  nodeId: string;
};
export type TokenCosts_TokenCostsDetailsQuery$data = {
  readonly node: {
    readonly costDetailSummaryEntries?: ReadonlyArray<{
      readonly isPrompt: boolean;
      readonly tokenType: string;
      readonly value: {
        readonly cost: number | null;
        readonly costPerToken: number | null;
        readonly tokens: number | null;
      };
    }>;
  };
};
export type TokenCosts_TokenCostsDetailsQuery = {
  response: TokenCosts_TokenCostsDetailsQuery$data;
  variables: TokenCosts_TokenCostsDetailsQuery$variables;
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
v2 = [
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "cost",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "tokens",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "costPerToken",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v3 = {
  "kind": "InlineFragment",
  "selections": (v2/*: any*/),
  "type": "Span",
  "abstractKey": null
},
v4 = {
  "kind": "InlineFragment",
  "selections": (v2/*: any*/),
  "type": "Trace",
  "abstractKey": null
},
v5 = {
  "kind": "InlineFragment",
  "selections": (v2/*: any*/),
  "type": "ProjectSession",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TokenCosts_TokenCostsDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v4/*: any*/),
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "TokenCosts_TokenCostsDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
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
    "cacheID": "621be4b260aab8b119610e7089d8f825",
    "id": null,
    "metadata": {},
    "name": "TokenCosts_TokenCostsDetailsQuery",
    "operationKind": "query",
    "text": "query TokenCosts_TokenCostsDetailsQuery(\n  $nodeId: ID!\n) {\n  node(id: $nodeId) {\n    __typename\n    ... on Span {\n      costDetailSummaryEntries {\n        tokenType\n        isPrompt\n        value {\n          cost\n          tokens\n          costPerToken\n        }\n      }\n    }\n    ... on Trace {\n      costDetailSummaryEntries {\n        tokenType\n        isPrompt\n        value {\n          cost\n          tokens\n          costPerToken\n        }\n      }\n    }\n    ... on ProjectSession {\n      costDetailSummaryEntries {\n        tokenType\n        isPrompt\n        value {\n          cost\n          tokens\n          costPerToken\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "501319a4bf950875b2169e3b81d966cd";

export default node;
