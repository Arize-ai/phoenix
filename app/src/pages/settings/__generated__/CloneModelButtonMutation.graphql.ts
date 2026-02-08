/**
 * @generated SignedSource<<528d0b5ebfddf2d8d89f14d30af25d98>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeModelKind = "BUILT_IN" | "CUSTOM";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "XAI";
export type TokenKind = "COMPLETION" | "PROMPT";
export type CreateModelMutationInput = {
  costs: ReadonlyArray<TokenPriceInput>;
  name: string;
  namePattern: string;
  provider?: string | null;
  startTime?: string | null;
};
export type TokenPriceInput = {
  costPerMillionTokens: number;
  kind: TokenKind;
  tokenType: string;
};
export type CloneModelButtonMutation$variables = {
  connectionId: string;
  input: CreateModelMutationInput;
};
export type CloneModelButtonMutation$data = {
  readonly createModel: {
    readonly model: {
      readonly createdAt: string;
      readonly id: string;
      readonly kind: GenerativeModelKind;
      readonly lastUsedAt: string | null;
      readonly name: string;
      readonly namePattern: string;
      readonly provider: string | null;
      readonly providerKey: GenerativeProviderKey | null;
      readonly startTime: string | null;
      readonly tokenPrices: ReadonlyArray<{
        readonly costPerMillionTokens: number;
        readonly kind: TokenKind;
        readonly tokenType: string;
      }>;
      readonly updatedAt: string;
    };
  };
};
export type CloneModelButtonMutation = {
  response: CloneModelButtonMutation$data;
  variables: CloneModelButtonMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "GenerativeModel",
  "kind": "LinkedField",
  "name": "model",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
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
      "name": "provider",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "namePattern",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "providerKey",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "startTime",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "createdAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "updatedAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lastUsedAt",
      "storageKey": null
    },
    (v3/*: any*/),
    {
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
        (v3/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "costPerMillionTokens",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "CloneModelButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "CreateModelMutationPayload",
        "kind": "LinkedField",
        "name": "createModel",
        "plural": false,
        "selections": [
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "CloneModelButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "CreateModelMutationPayload",
        "kind": "LinkedField",
        "name": "createModel",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "prependNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "model",
            "handleArgs": [
              {
                "items": [
                  {
                    "kind": "Variable",
                    "name": "connections.0",
                    "variableName": "connectionId"
                  }
                ],
                "kind": "ListValue",
                "name": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "GenerativeModelEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "38d9fd18934c13a39750554ecbb30fb9",
    "id": null,
    "metadata": {},
    "name": "CloneModelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation CloneModelButtonMutation(\n  $input: CreateModelMutationInput!\n) {\n  createModel(input: $input) {\n    model {\n      id\n      name\n      provider\n      namePattern\n      providerKey\n      startTime\n      createdAt\n      updatedAt\n      lastUsedAt\n      kind\n      tokenPrices {\n        tokenType\n        kind\n        costPerMillionTokens\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "74b3cb4e7feb2375336e29fc7745bc33";

export default node;
