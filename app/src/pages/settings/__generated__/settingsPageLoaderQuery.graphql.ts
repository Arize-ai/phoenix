/**
 * @generated SignedSource<<5d9562447b1ec9aee54d580a20800dfd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type settingsPageLoaderQuery$variables = Record<PropertyKey, never>;
export type settingsPageLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DBUsagePieChart_data" | "GenerativeProvidersCard_data">;
};
export type settingsPageLoaderQuery = {
  response: settingsPageLoaderQuery$data;
  variables: settingsPageLoaderQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "settingsPageLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "GenerativeProvidersCard_data"
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DBUsagePieChart_data"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "settingsPageLoaderQuery",
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
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "DbTableStats",
        "kind": "LinkedField",
        "name": "dbTableStats",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "tableName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "numBytes",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "dbStorageCapacityBytes",
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "57e864e0c3d3ad1ca6853bcc545b0b63",
    "id": null,
    "metadata": {},
    "name": "settingsPageLoaderQuery",
    "operationKind": "query",
    "text": "query settingsPageLoaderQuery {\n  ...GenerativeProvidersCard_data\n  ...DBUsagePieChart_data\n}\n\nfragment DBUsagePieChart_data on Query {\n  dbTableStats {\n    tableName\n    numBytes\n  }\n  dbStorageCapacityBytes\n}\n\nfragment GenerativeProvidersCard_data on Query {\n  modelProviders {\n    name\n    key\n    dependenciesInstalled\n    dependencies\n    apiKeyEnvVar\n    apiKeySet\n  }\n}\n"
  }
};

(node as any).hash = "69a5a0039a171639cb4817f6d966030c";

export default node;
