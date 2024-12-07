/**
 * @generated SignedSource<<0bee2c9001d3d5aa25d4bffb2c797002>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "GEMINI" | "OPENAI";
export type ModelConfigButtonDialogQuery$variables = {
  providerKey: GenerativeProviderKey;
};
export type ModelConfigButtonDialogQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ModelComboBoxFragment" | "ModelProviderPickerFragment">;
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
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ModelConfigButtonDialogQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ModelProviderPickerFragment"
      },
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "ModelComboBoxFragment"
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
          (v2/*: any*/),
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
        "alias": null,
        "args": [
          {
            "fields": (v1/*: any*/),
            "kind": "ObjectValue",
            "name": "input"
          }
        ],
        "concreteType": "GenerativeModel",
        "kind": "LinkedField",
        "name": "models",
        "plural": true,
        "selections": [
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "bdb684f5a15c4708a04e07bb53c8b016",
    "id": null,
    "metadata": {},
    "name": "ModelConfigButtonDialogQuery",
    "operationKind": "query",
    "text": "query ModelConfigButtonDialogQuery(\n  $providerKey: GenerativeProviderKey!\n) {\n  ...ModelProviderPickerFragment\n  ...ModelComboBoxFragment_3rERSq\n}\n\nfragment ModelComboBoxFragment_3rERSq on Query {\n  models(input: {providerKey: $providerKey}) {\n    name\n  }\n}\n\nfragment ModelProviderPickerFragment on Query {\n  modelProviders {\n    key\n    name\n    dependenciesInstalled\n    dependencies\n  }\n}\n"
  }
};
})();

(node as any).hash = "7203a9b14b3d128fdec37b0e7169f6e3";

export default node;
