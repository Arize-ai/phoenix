/**
 * @generated SignedSource<<e893a007be9d4b770a6035ddf2dffdb0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeModelSDK = "ANTHROPIC" | "AWS_BEDROCK" | "AZURE_OPENAI" | "GOOGLE_GENAI" | "OPENAI";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type ModelType = "DECISION" | "LLM";
export type useModelMenuDataQuery$variables = Record<PropertyKey, never>;
export type useModelMenuDataQuery$data = {
  readonly decisionModels: ReadonlyArray<{
    readonly modelType: ModelType;
    readonly name: string;
    readonly providerKey: GenerativeProviderKey;
  }>;
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
    readonly modelType: ModelType;
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
  (v0/*:: as any*/),
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
    "name": "modelType",
    "storageKey": null
  }
],
v2 = [
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
    "selections": (v1/*:: as any*/),
    "storageKey": null
  },
  {
    "alias": "decisionModels",
    "args": [
      {
        "kind": "Literal",
        "name": "input",
        "value": {
          "modelType": "DECISION",
          "providerKey": null
        }
      }
    ],
    "concreteType": "PlaygroundModel",
    "kind": "LinkedField",
    "name": "playgroundModels",
    "plural": true,
    "selections": (v1/*:: as any*/),
    "storageKey": "playgroundModels(input:{\"modelType\":\"DECISION\",\"providerKey\":null})"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useModelMenuDataQuery",
    "selections": (v2/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useModelMenuDataQuery",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "2a5997f348fccc709e43c6c174edd2a6",
    "id": null,
    "metadata": {},
    "name": "useModelMenuDataQuery",
    "operationKind": "query",
    "text": "query useModelMenuDataQuery {\n  generativeModelCustomProviders {\n    edges {\n      node {\n        id\n        name\n        sdk\n        modelNames\n      }\n    }\n  }\n  modelProviders {\n    key\n    name\n    dependenciesInstalled\n    credentialsSet\n  }\n  playgroundModels {\n    name\n    providerKey\n    modelType\n  }\n  decisionModels: playgroundModels(input: {providerKey: null, modelType: DECISION}) {\n    name\n    providerKey\n    modelType\n  }\n}\n"
  }
};
})();

(node as any).hash = "52927a0b467250bcfca5509be16ca79c";

export default node;
