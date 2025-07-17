/**
 * @generated SignedSource<<22f0cd62c4db2cf41d51c2aa52c4b130>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SessionTokenCostsDetailsQuery$variables = {
  nodeId: string;
};
export type SessionTokenCostsDetailsQuery$data = {
  readonly node: {
    readonly __typename: "ProjectSession";
    readonly costDetailSummaryEntries: ReadonlyArray<{
      readonly isPrompt: boolean;
      readonly tokenType: string;
      readonly value: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
    }>;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type SessionTokenCostsDetailsQuery = {
  response: SessionTokenCostsDetailsQuery$data;
  variables: SessionTokenCostsDetailsQuery$variables;
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
  "kind": "InlineFragment",
  "selections": [
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
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ProjectSession",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionTokenCostsDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/)
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
    "name": "SessionTokenCostsDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
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
    "cacheID": "5c5cd200597f3c5c5415851c9d8a52fd",
    "id": null,
    "metadata": {},
    "name": "SessionTokenCostsDetailsQuery",
    "operationKind": "query",
    "text": "query SessionTokenCostsDetailsQuery(\n  $nodeId: ID!\n) {\n  node(id: $nodeId) {\n    __typename\n    ... on ProjectSession {\n      costDetailSummaryEntries {\n        tokenType\n        isPrompt\n        value {\n          cost\n          tokens\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "4ff1881d1c2662709204991c58108dcb";

export default node;
