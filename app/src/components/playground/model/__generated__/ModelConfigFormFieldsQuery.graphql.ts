/**
 * @generated SignedSource<<3c5326112b81409638c35b19fb6e308b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelConfigFormFieldsQuery$variables = Record<PropertyKey, never>;
export type ModelConfigFormFieldsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ModelProviderSelectFragment">;
};
export type ModelConfigFormFieldsQuery = {
  response: ModelConfigFormFieldsQuery$data;
  variables: ModelConfigFormFieldsQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ModelConfigFormFieldsQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ModelProviderSelectFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ModelConfigFormFieldsQuery",
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
    "cacheID": "40d355a118248a8543daad15e9fe4d9b",
    "id": null,
    "metadata": {},
    "name": "ModelConfigFormFieldsQuery",
    "operationKind": "query",
    "text": "query ModelConfigFormFieldsQuery {\n  ...ModelProviderSelectFragment\n}\n\nfragment ModelProviderSelectFragment on Query {\n  modelProviders {\n    key\n    name\n    dependenciesInstalled\n    dependencies\n  }\n}\n"
  }
};

(node as any).hash = "d63ce0e6beceb87081792c8e99b6db3d";

export default node;
