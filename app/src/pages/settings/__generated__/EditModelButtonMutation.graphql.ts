/**
 * @generated SignedSource<<3f8c14fe610c371315bb32a3964adeaf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type UpdateModelMutationInput = {
  costs: ReadonlyArray<CostPerTokenInput>;
  id: string;
  name: string;
  namePattern: string;
  provider?: string | null;
};
export type CostPerTokenInput = {
  costPerToken: number;
  isPrompt?: boolean | null;
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
    "cacheID": "e6dca8cc5cc393912d6a49783428ace3",
    "id": null,
    "metadata": {},
    "name": "EditModelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation EditModelButtonMutation(\n  $input: UpdateModelMutationInput!\n) {\n  updateModel(input: $input) {\n    model {\n      id\n      name\n      provider\n      namePattern\n      providerKey\n      tokenCost {\n        input\n        output\n        cacheRead\n        cacheWrite\n        promptAudio\n        completionAudio\n        reasoning\n      }\n    }\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "202e64f8f5e7ec16860d3ceaba5e2ff3";

export default node;
