/**
 * @generated SignedSource<<5529411b7c76ab62d2e82fac37e8dacf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type ModelMenuQuery$variables = Record<PropertyKey, never>;
export type ModelMenuQuery$data = {
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
    "cacheID": "d0031da38b17c09c52f59fe219bcdff7",
    "id": null,
    "metadata": {},
    "name": "ModelMenuQuery",
    "operationKind": "query",
    "text": "query ModelMenuQuery {\n  modelProviders {\n    key\n    name\n    dependenciesInstalled\n  }\n  playgroundModels {\n    name\n    providerKey\n  }\n}\n"
  }
};
})();

(node as any).hash = "dd2cd77044dac5b1f5b3d1fc0dfaa61b";

export default node;
