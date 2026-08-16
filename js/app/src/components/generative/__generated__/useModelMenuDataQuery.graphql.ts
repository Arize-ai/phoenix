/**
 * @generated SignedSource<<4cce8447c6b0336de75e01f1617983b7>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeModelSDK = "ANTHROPIC" | "AWS_BEDROCK" | "AZURE_OPENAI" | "GOOGLE_GENAI" | "OPENAI";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type useModelMenuDataQuery$variables = Record<PropertyKey, never>;
export type useModelMenuDataQuery$data = {
  readonly generativeModelCustomProviders: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly modelNames: ReadonlyArray<string>;
        readonly name: string;
        readonly sdk: GenerativeModelSDK;
      };
    }>;
  };
  readonly modelProviders: ReadonlyArray<{
    readonly credentialsSet: boolean;
    readonly dependenciesInstalled: boolean;
    readonly key: GenerativeProviderKey;
    readonly name: string;
  }>;
  readonly playgroundModels: ReadonlyArray<{
    readonly name: string;
    readonly providerKey: GenerativeProviderKey;
  }>;
};
export type useModelMenuDataQuery = {
  response: useModelMenuDataQuery$data;
  variables: useModelMenuDataQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "GenerativeModelCustomProviderConnection",
    "kind": "LinkedField",
    "name": "generativeModelCustomProviders",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "GenerativeModelCustomProviderEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "GenerativeModelCustomProvider",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
              (v0/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "sdk",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "modelNames",
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
    "concreteType": "GenerativeProvider",
    "kind": "LinkedField",
    "name": "modelProviders",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "key",
        "storageKey": null
      },
      (v0/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "dependenciesInstalled",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "credentialsSet",
        "storageKey": null
      }
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "PlaygroundModel",
    "kind": "LinkedField",
    "name": "playgroundModels",
    "plural": true,
    "selections": [
      (v0/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "providerKey",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useModelMenuDataQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useModelMenuDataQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "700a417c415e5bc889e79dce3bf18e53",
    "id": null,
    "metadata": {},
    "name": "useModelMenuDataQuery",
    "operationKind": "query",
    "text": "query useModelMenuDataQuery {\n  generativeModelCustomProviders {\n    edges {\n      node {\n        id\n        name\n        sdk\n        modelNames\n      }\n    }\n  }\n  modelProviders {\n    key\n    name\n    dependenciesInstalled\n    credentialsSet\n  }\n  playgroundModels {\n    name\n    providerKey\n  }\n}\n"
  }
};
})();

(node as any).hash = "f60d71682e63a12728470a15b4d7daf4";

export default node;
