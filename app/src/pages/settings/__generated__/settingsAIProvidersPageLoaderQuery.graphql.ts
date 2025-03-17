/**
 * @generated SignedSource<<c8b2423e06fab062b5127b3ee540e643>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type settingsAIProvidersPageLoaderQuery$variables = Record<PropertyKey, never>;
export type settingsAIProvidersPageLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"GenerativeProvidersCard_data">;
};
export type settingsAIProvidersPageLoaderQuery = {
  response: settingsAIProvidersPageLoaderQuery$data;
  variables: settingsAIProvidersPageLoaderQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "settingsAIProvidersPageLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "GenerativeProvidersCard_data"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "settingsAIProvidersPageLoaderQuery",
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
            "name": "name",
            "storageKey": null
          },
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
            "name": "dependenciesInstalled",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "dependencies",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "apiKeyEnvVar",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "apiKeySet",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "cc6e19e54ea894e905970362ee382e43",
    "id": null,
    "metadata": {},
    "name": "settingsAIProvidersPageLoaderQuery",
    "operationKind": "query",
    "text": "query settingsAIProvidersPageLoaderQuery {\n  ...GenerativeProvidersCard_data\n}\n\nfragment GenerativeProvidersCard_data on Query {\n  modelProviders {\n    name\n    key\n    dependenciesInstalled\n    dependencies\n    apiKeyEnvVar\n    apiKeySet\n  }\n}\n"
  }
};

(node as any).hash = "2c8eecb8897f8c7dadfdc3de4e2a41a8";

export default node;
