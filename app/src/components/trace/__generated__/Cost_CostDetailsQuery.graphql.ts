/**
 * @generated SignedSource<<6b0c70af09def1966cfa9f9f39a67e90>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type Cost_CostDetailsQuery$variables = {
  nodeId: string;
};
export type Cost_CostDetailsQuery$data = {
  readonly node: {
    readonly __typename: "Span";
    readonly cost: {
      readonly cacheReadTokenCost: number | null;
      readonly cacheWriteTokenCost: number | null;
      readonly completionAudioTokenCost: number | null;
      readonly inputTokenCost: number | null;
      readonly outputTokenCost: number | null;
      readonly promptAudioTokenCost: number | null;
    } | null;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type Cost_CostDetailsQuery = {
  response: Cost_CostDetailsQuery$data;
  variables: Cost_CostDetailsQuery$variables;
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
      "concreteType": "SpanCost",
      "kind": "LinkedField",
      "name": "cost",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "inputTokenCost",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "outputTokenCost",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "cacheReadTokenCost",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "cacheWriteTokenCost",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "promptAudioTokenCost",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "completionAudioTokenCost",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "Cost_CostDetailsQuery",
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
    "name": "Cost_CostDetailsQuery",
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
    "cacheID": "9f7d1987ba6f4732419e364d3a12b2ef",
    "id": null,
    "metadata": {},
    "name": "Cost_CostDetailsQuery",
    "operationKind": "query",
    "text": "query Cost_CostDetailsQuery(\n  $nodeId: ID!\n) {\n  node(id: $nodeId) {\n    __typename\n    ... on Span {\n      cost {\n        inputTokenCost\n        outputTokenCost\n        cacheReadTokenCost\n        cacheWriteTokenCost\n        promptAudioTokenCost\n        completionAudioTokenCost\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "3f0843f26d0129a921ef72bd09488340";

export default node;
