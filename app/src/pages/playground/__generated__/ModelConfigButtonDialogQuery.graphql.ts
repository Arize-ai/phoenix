/**
 * @generated SignedSource<<dfe7f546aee7b7d1747b599c71b83ff7>>
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
  readonly " $fragmentSpreads": FragmentRefs<"ModelPickerFragment" | "ModelProviderPickerFragment">;
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
    "cacheID": "312c7daf378370f2936ee987869d155d",
    "id": null,
    "metadata": {},
    "name": "ModelConfigButtonDialogQuery",
    "operationKind": "query",
    "text": "query ModelConfigButtonDialogQuery(\n  $providerKey: GenerativeProviderKey!\n) {\n  ...ModelProviderPickerFragment\n  ...ModelPickerFragment_3rERSq\n}\n\nfragment ModelPickerFragment_3rERSq on Query {\n  models(input: {providerKey: $providerKey}) {\n    name\n  }\n}\n\nfragment ModelProviderPickerFragment on Query {\n  modelProviders {\n    key\n    name\n    dependenciesInstalled\n    dependencies\n  }\n}\n"
  }
};
})();

(node as any).hash = "c9b38e766093b2378047d22b01ef0fbf";

export default node;
