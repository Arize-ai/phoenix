/**
 * @generated SignedSource<<dbb1839a06e52771dbf10fa67d598401>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type TokenKind = "COMPLETION" | "PROMPT";
export type CloneModelButtonQuery$variables = {
  id: string;
};
export type CloneModelButtonQuery$data = {
  readonly node: {
    readonly id?: string;
    readonly name?: string;
    readonly namePattern?: string;
    readonly provider?: string | null;
    readonly providerKey?: GenerativeProviderKey | null;
    readonly startTime?: string | null;
    readonly tokenPrices?: ReadonlyArray<{
      readonly costPerMillionTokens: number;
      readonly costPerToken: number;
      readonly kind: TokenKind;
      readonly tokenType: string;
    }>;
  };
};
export type CloneModelButtonQuery = {
  response: CloneModelButtonQuery$data;
  variables: CloneModelButtonQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
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
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "provider",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "namePattern",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "providerKey",
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
  "concreteType": "TokenPrice",
  "kind": "LinkedField",
  "name": "tokenPrices",
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
      "name": "kind",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "costPerMillionTokens",
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CloneModelButtonQuery",
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
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/)
            ],
            "type": "GenerativeModel",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "CloneModelButtonQuery",
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
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/)
            ],
            "type": "GenerativeModel",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "45cd1db550a23d19841fd50896301189",
    "id": null,
    "metadata": {},
    "name": "CloneModelButtonQuery",
    "operationKind": "query",
    "text": "query CloneModelButtonQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on GenerativeModel {\n      id\n      name\n      provider\n      namePattern\n      providerKey\n      startTime\n      tokenPrices {\n        tokenType\n        kind\n        costPerMillionTokens\n        costPerToken\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "cba8eee925e486e55b778eeea3ee350c";

export default node;
