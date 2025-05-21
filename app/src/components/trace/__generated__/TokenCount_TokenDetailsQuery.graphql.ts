/**
 * @generated SignedSource<<db299d6500536b60c689be3966a12698>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TokenCount_TokenDetailsQuery$variables = {
  nodeId: string;
};
export type TokenCount_TokenDetailsQuery$data = {
  readonly node: {
    readonly __typename: "ProjectSession";
    readonly tokenUsage: {
      readonly completion: number;
      readonly prompt: number;
    };
  } | {
    readonly __typename: "Span";
    readonly tokenCountCompletion: number | null;
    readonly tokenCountPrompt: number | null;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type TokenCount_TokenDetailsQuery = {
  response: TokenCount_TokenDetailsQuery$data;
  variables: TokenCount_TokenDetailsQuery$variables;
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
  "type": "Span",
  "abstractKey": null
},
v4 = {
  "kind": "InlineFragment",
  "selections": [
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
          "name": "prompt",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "completion",
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
    "name": "TokenCount_TokenDetailsQuery",
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
          (v4/*: any*/)
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
    "name": "TokenCount_TokenDetailsQuery",
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
          (v4/*: any*/),
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
    "cacheID": "f3419182693434731da3b70ab7396fea",
    "id": null,
    "metadata": {},
    "name": "TokenCount_TokenDetailsQuery",
    "operationKind": "query",
    "text": "query TokenCount_TokenDetailsQuery(\n  $nodeId: ID!\n) {\n  node(id: $nodeId) {\n    __typename\n    ... on Span {\n      tokenCountPrompt\n      tokenCountCompletion\n    }\n    ... on ProjectSession {\n      tokenUsage {\n        prompt\n        completion\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "3e1c840ea0d5db177eb871bdbd6b1e25";

export default node;
