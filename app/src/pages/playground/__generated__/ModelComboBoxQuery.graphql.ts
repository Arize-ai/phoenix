/**
 * @generated SignedSource<<fc71d579e3d8c6ac3cbbf8e87831ac62>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type ModelComboBoxQuery$variables = {
  providerKey: GenerativeProviderKey;
};
export type ModelComboBoxQuery$data = {
  readonly playgroundModels: ReadonlyArray<{
    readonly name: string;
  }>;
};
export type ModelComboBoxQuery = {
  response: ModelComboBoxQuery$data;
  variables: ModelComboBoxQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "providerKey"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "providerKey",
            "variableName": "providerKey"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "PlaygroundModel",
    "kind": "LinkedField",
    "name": "playgroundModels",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "name",
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
    "name": "ModelComboBoxQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ModelComboBoxQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "67fe753e1bc2ede814f616699bf7f3bb",
    "id": null,
    "metadata": {},
    "name": "ModelComboBoxQuery",
    "operationKind": "query",
    "text": "query ModelComboBoxQuery(\n  $providerKey: GenerativeProviderKey!\n) {\n  playgroundModels(input: {providerKey: $providerKey}) {\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "1e812293e1547b594275780290b294be";

export default node;
