/**
 * @generated SignedSource<<670707a6ff9ce3e9e1b2d7ae458abdae>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "OPENAI";
export type ModelConfigButtonDialogQuery$variables = {
  providerKey: GenerativeProviderKey;
};
export type ModelConfigButtonDialogQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ModelPickerFragment">;
};
export type ModelConfigButtonDialogQuery = {
  response: ModelConfigButtonDialogQuery$data;
  variables: ModelConfigButtonDialogQuery$variables;
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
    "kind": "Variable",
    "name": "providerKey",
    "variableName": "providerKey"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ModelConfigButtonDialogQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "ModelPickerFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ModelConfigButtonDialogQuery",
    "selections": [
      {
        "alias": null,
        "args": [
          {
            "fields": (v1/*: any*/),
            "kind": "ObjectValue",
            "name": "input"
          }
        ],
        "kind": "ScalarField",
        "name": "modelNames",
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ea5b5a195f8d49162ea7569c404e95a8",
    "id": null,
    "metadata": {},
    "name": "ModelConfigButtonDialogQuery",
    "operationKind": "query",
    "text": "query ModelConfigButtonDialogQuery(\n  $providerKey: GenerativeProviderKey!\n) {\n  ...ModelPickerFragment_3rERSq\n}\n\nfragment ModelPickerFragment_3rERSq on Query {\n  modelNames(input: {providerKey: $providerKey})\n}\n"
  }
};
})();

(node as any).hash = "583e923b5f31768db52e0f5dcbdda28c";

export default node;
