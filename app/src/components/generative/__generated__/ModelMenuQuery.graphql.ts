/**
 * @generated SignedSource<<09d12b72db686ec21e0c48f3d33ac488>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeModelSDK = "ANTHROPIC" | "AWS_BEDROCK" | "AZURE_OPENAI" | "GOOGLE_GENAI" | "OPENAI";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type ModelMenuQuery$variables = Record<PropertyKey, never>;
export type ModelMenuQuery$data = {
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
    readonly dependenciesInstalled: boolean;
    readonly key: GenerativeProviderKey;
    readonly name: string;
  }>;
  readonly playgroundModels: ReadonlyArray<{
    readonly name: string;
    readonly providerKey: GenerativeProviderKey;
  }>;
};
export type ModelMenuQuery = {
  response: ModelMenuQuery$data;
  variables: ModelMenuQuery$variables;
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
              (v0/*: any*/),
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
      (v0/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "dependenciesInstalled",
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
      (v0/*: any*/),
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
    "name": "ModelMenuQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ModelMenuQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "fbc5c763256fede25fb3f8cc0cc9f60d",
    "id": null,
    "metadata": {},
    "name": "ModelMenuQuery",
    "operationKind": "query",
    "text": "query ModelMenuQuery {\n  generativeModelCustomProviders {\n    edges {\n      node {\n        id\n        name\n        sdk\n        modelNames\n      }\n    }\n  }\n  modelProviders {\n    key\n    name\n    dependenciesInstalled\n  }\n  playgroundModels {\n    name\n    providerKey\n  }\n}\n"
  }
};
})();

(node as any).hash = "656fd764c70299c13142bc527235b0b8";

export default node;
