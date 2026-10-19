/**
 * @generated SignedSource<<8e8bd9ee5d6a193b3e7dae787dc8e4df>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type PlaygroundQuery$variables = Record<PropertyKey, never>;
export type PlaygroundQuery$data = {
  readonly decisionModels: ReadonlyArray<{
    readonly name: string;
    readonly providerKey: GenerativeProviderKey;
  }>;
  readonly modelProviders: ReadonlyArray<{
    readonly dependencies: ReadonlyArray<string>;
    readonly dependenciesInstalled: boolean;
    readonly name: string;
  }>;
};
export type PlaygroundQuery = {
  response: PlaygroundQuery$data;
  variables: PlaygroundQuery$variables;
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
    "concreteType": "GenerativeProvider",
    "kind": "LinkedField",
    "name": "modelProviders",
    "plural": true,
    "selections": [
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
        "name": "dependencies",
        "storageKey": null
      }
    ],
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
    "storageKey": "playgroundModels(input:{\"modelType\":\"DECISION\",\"providerKey\":null})"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PlaygroundQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "3056476ec15e65ae89832ac5c4e46b82",
    "id": null,
    "metadata": {},
    "name": "PlaygroundQuery",
    "operationKind": "query",
    "text": "query PlaygroundQuery {\n  modelProviders {\n    name\n    dependenciesInstalled\n    dependencies\n  }\n  decisionModels: playgroundModels(input: {providerKey: null, modelType: DECISION}) {\n    name\n    providerKey\n  }\n}\n"
  }
};
})();

(node as any).hash = "886983ade6984a0e650358718f76302e";

export default node;
