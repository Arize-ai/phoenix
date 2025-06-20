/**
 * @generated SignedSource<<56821ab3242cf4b7287652147e781cc2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
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
      readonly costDetailSummaryEntries: ReadonlyArray<{
        readonly isPrompt: boolean;
        readonly tokenType: string;
        readonly value: {
          readonly cost: number | null;
          readonly costPerToken: number | null;
          readonly tokens: number | null;
        };
      }>;
      readonly id: string;
      readonly name: string;
      readonly namePattern: string;
      readonly provider: string | null;
      readonly providerKey: GenerativeProviderKey | null;
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
                    "name": "tokens",
                    "storageKey": null
                  },
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
                    "name": "costPerToken",
                    "storageKey": null
                  }
                ],
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
    "cacheID": "f7b978d5c18caea005d5096364f91779",
    "id": null,
    "metadata": {},
    "name": "EditModelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation EditModelButtonMutation(\n  $input: UpdateModelMutationInput!\n) {\n  updateModel(input: $input) {\n    model {\n      id\n      name\n      provider\n      namePattern\n      providerKey\n      costDetailSummaryEntries {\n        tokenType\n        isPrompt\n        value {\n          tokens\n          cost\n          costPerToken\n        }\n      }\n    }\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "e5b0b221e91e1580525202e9b3a669c6";

export default node;
