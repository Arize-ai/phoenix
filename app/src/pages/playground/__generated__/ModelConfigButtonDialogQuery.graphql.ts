/**
 * @generated SignedSource<<c47b4b5d417dfa5f0ca4d3abe1001a61>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelConfigButtonDialogQuery$variables = Record<PropertyKey, never>;
export type ModelConfigButtonDialogQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ModelProviderPickerFragment">;
};
export type ModelConfigButtonDialogQuery = {
  response: ModelConfigButtonDialogQuery$data;
  variables: ModelConfigButtonDialogQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ModelConfigButtonDialogQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ModelProviderPickerFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
            "storageKey": null
          },
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
      }
    ]
  },
  "params": {
    "cacheID": "64ad561d3ca07bdded6af274c73eb18a",
    "id": null,
    "metadata": {},
    "name": "ModelConfigButtonDialogQuery",
    "operationKind": "query",
    "text": "query ModelConfigButtonDialogQuery {\n  ...ModelProviderPickerFragment\n}\n\nfragment ModelProviderPickerFragment on Query {\n  modelProviders {\n    key\n    name\n    dependenciesInstalled\n    dependencies\n  }\n}\n"
  }
};

(node as any).hash = "4b1b96842c19ea5721b7fcf1cdb86426";

export default node;
