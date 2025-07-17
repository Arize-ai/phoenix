/**
 * @generated SignedSource<<6d5e9efb0253b237206106fe733be288>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type TokenKind = "COMPLETION" | "PROMPT";
export type UpdateModelMutationInput = {
  costs: ReadonlyArray<TokenPriceInput>;
  id: string;
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
export type EditModelButtonMutation$variables = {
  input: UpdateModelMutationInput;
};
export type EditModelButtonMutation$data = {
  readonly updateModel: {
    readonly __typename: "UpdateModelMutationPayload";
    readonly model: {
      readonly id: string;
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
    };
  };
};
export type EditModelButtonMutation = {
  response: EditModelButtonMutation$data;
  variables: EditModelButtonMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "UpdateModelMutationPayload",
    "kind": "LinkedField",
    "name": "updateModel",
    "plural": false,
    "selections": [
      {
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
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditModelButtonMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditModelButtonMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "527afcf6cbbf906d8ddc80b5a34cdb3a",
    "id": null,
    "metadata": {},
    "name": "EditModelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation EditModelButtonMutation(\n  $input: UpdateModelMutationInput!\n) {\n  updateModel(input: $input) {\n    model {\n      id\n      name\n      provider\n      namePattern\n      providerKey\n      startTime\n      tokenPrices {\n        tokenType\n        kind\n        costPerMillionTokens\n      }\n    }\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "ffba87369eaaf51ba050d13e4f417efa";

export default node;
