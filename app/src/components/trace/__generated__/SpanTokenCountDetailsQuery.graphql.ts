/**
 * @generated SignedSource<<c02524ba8d6070472d829ff19b0898fd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SpanTokenCountDetailsQuery$variables = {
  nodeId: string;
};
export type SpanTokenCountDetailsQuery$data = {
  readonly node: {
    readonly __typename: "Span";
    readonly tokenCountCompletion: number | null;
    readonly tokenCountPrompt: number | null;
    readonly tokenCountTotal: number | null;
    readonly tokenPromptDetails: {
      readonly audio: number | null;
      readonly cacheRead: number | null;
      readonly cacheWrite: number | null;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type SpanTokenCountDetailsQuery = {
  response: SpanTokenCountDetailsQuery$data;
  variables: SpanTokenCountDetailsQuery$variables;
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
      "concreteType": "TokenCountPromptDetails",
      "kind": "LinkedField",
      "name": "tokenPromptDetails",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "audio",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "cacheRead",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "cacheWrite",
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
    "name": "SpanTokenCountDetailsQuery",
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
    "name": "SpanTokenCountDetailsQuery",
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
    "cacheID": "fc6d8104f9bf9481330b8b879b7c8e8e",
    "id": null,
    "metadata": {},
    "name": "SpanTokenCountDetailsQuery",
    "operationKind": "query",
    "text": "query SpanTokenCountDetailsQuery(\n  $nodeId: ID!\n) {\n  node(id: $nodeId) {\n    __typename\n    ... on Span {\n      tokenCountTotal\n      tokenCountPrompt\n      tokenCountCompletion\n      tokenPromptDetails {\n        audio\n        cacheRead\n        cacheWrite\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "2f53943dbe7d189d4126be701a017818";

export default node;
