/**
 * @generated SignedSource<<383c0eb45f710282fe3ca633bd9ed920>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeModelType = "DECISION" | "EMBEDDING" | "LLM";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type TokenKind = "COMPLETION" | "PROMPT";
export type EditModelButtonQuery$variables = {
  id: string;
};
export type EditModelButtonQuery$data = {
  readonly node: {
    readonly id?: string;
    readonly modelType?: GenerativeModelType;
    readonly name?: string;
    readonly namePattern?: string;
    readonly provider?: string | null;
    readonly providerKey?: GenerativeProviderKey | null;
    readonly startTime?: string | null;
    readonly tokenPrices?: ReadonlyArray<{
      readonly costPerMillionTokens: number;
      readonly kind: TokenKind;
      readonly tokenType: string;
    }>;
  };
};
export type EditModelButtonQuery = {
  response: EditModelButtonQuery$data;
  variables: EditModelButtonQuery$variables;
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
  "name": "modelType",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "provider",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "namePattern",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "providerKey",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v9 = {
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
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditModelButtonQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/)
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EditModelButtonQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/)
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
    "cacheID": "cbf238c7ff7bcedacc13d8fa41876ca5",
    "id": null,
    "metadata": {},
    "name": "EditModelButtonQuery",
    "operationKind": "query",
    "text": "query EditModelButtonQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on GenerativeModel {\n      id\n      name\n      modelType\n      provider\n      namePattern\n      providerKey\n      startTime\n      tokenPrices {\n        tokenType\n        kind\n        costPerMillionTokens\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "5de1c47bdfe5d53035c7a0c864ffcc65";

export default node;
