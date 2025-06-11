/**
 * @generated SignedSource<<feb9c8ac82afe8b892265f3af9d5e804>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type CreateModelMutationInput = {
  cacheReadCostPerToken?: number | null;
  cacheWriteCostPerToken?: number | null;
  completionAudioCostPerToken?: number | null;
  inputCostPerToken: number;
  name: string;
  namePattern: string;
  outputCostPerToken: number;
  promptAudioCostPerToken?: number | null;
  providerKey?: GenerativeProviderKey | null;
  reasoningCostPerToken?: number | null;
};
export type CloneModelButtonMutation$variables = {
  input: CreateModelMutationInput;
};
export type CloneModelButtonMutation$data = {
  readonly createModel: {
    readonly __typename: "CreateModelMutationPayload";
    readonly model: {
      readonly id: string;
      readonly name: string;
      readonly namePattern: string;
      readonly provider: string | null;
      readonly providerKey: GenerativeProviderKey | null;
      readonly tokenCost: {
        readonly cacheRead: number | null;
        readonly cacheWrite: number | null;
        readonly completionAudio: number | null;
        readonly input: number | null;
        readonly output: number | null;
        readonly promptAudio: number | null;
        readonly reasoning: number | null;
      } | null;
    };
  };
};
export type CloneModelButtonMutation = {
  response: CloneModelButtonMutation$data;
  variables: CloneModelButtonMutation$variables;
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
    "concreteType": "CreateModelMutationPayload",
    "kind": "LinkedField",
    "name": "createModel",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Model",
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
            "concreteType": "TokenCost",
            "kind": "LinkedField",
            "name": "tokenCost",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "input",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "output",
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
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "promptAudio",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "completionAudio",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "reasoning",
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
    "name": "CloneModelButtonMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "CloneModelButtonMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "8f91857a82ea74e93605ea26bfc89ba4",
    "id": null,
    "metadata": {},
    "name": "CloneModelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation CloneModelButtonMutation(\n  $input: CreateModelMutationInput!\n) {\n  createModel(input: $input) {\n    model {\n      id\n      name\n      provider\n      namePattern\n      providerKey\n      tokenCost {\n        input\n        output\n        cacheRead\n        cacheWrite\n        promptAudio\n        completionAudio\n        reasoning\n      }\n    }\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "33404bbe6a73750cefc1d6375eba165e";

export default node;
