/**
 * @generated SignedSource<<fce2c4a7bbae7a6bb09eb67e9f72b8e6>>
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
  modelName?: string | null;
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
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "modelName"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "providerKey"
},
v2 = [
  {
    "kind": "Variable",
    "name": "modelName",
    "variableName": "modelName"
  },
  {
    "kind": "Variable",
    "name": "providerKey",
    "variableName": "providerKey"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
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
        "args": (v2/*: any*/),
        "kind": "FragmentSpread",
        "name": "ModelPickerFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
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
          (v3/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": [
          {
            "fields": (v2/*: any*/),
            "kind": "ObjectValue",
            "name": "input"
          }
        ],
        "concreteType": "GenerativeModel",
        "kind": "LinkedField",
        "name": "models",
        "plural": true,
        "selections": [
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "fcbba510010028e9bc78dc90011355b5",
    "id": null,
    "metadata": {},
    "name": "ModelConfigButtonDialogQuery",
    "operationKind": "query",
    "text": "query ModelConfigButtonDialogQuery(\n  $providerKey: GenerativeProviderKey!\n  $modelName: String\n) {\n  ...ModelProviderPickerFragment\n  ...ModelPickerFragment_3g5CNM\n}\n\nfragment ModelPickerFragment_3g5CNM on Query {\n  models(input: {providerKey: $providerKey, modelName: $modelName}) {\n    name\n  }\n}\n\nfragment ModelProviderPickerFragment on Query {\n  modelProviders {\n    key\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "a3e974dfd8ee43c81dee1aa291c93de4";

export default node;
