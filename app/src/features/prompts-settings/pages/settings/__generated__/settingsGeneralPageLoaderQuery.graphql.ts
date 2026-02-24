/**
 * @generated SignedSource<<fa905e20dbacac7a1f56ac32147ebea8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type settingsGeneralPageLoaderQuery$variables = Record<PropertyKey, never>;
export type settingsGeneralPageLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DBUsagePieChart_data">;
};
export type settingsGeneralPageLoaderQuery = {
  response: settingsGeneralPageLoaderQuery$data;
  variables: settingsGeneralPageLoaderQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "settingsGeneralPageLoaderQuery",
    "selections": [
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
    "name": "settingsGeneralPageLoaderQuery",
    "selections": [
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
    "cacheID": "b23054c72be2f3ddc335774d54407667",
    "id": null,
    "metadata": {},
    "name": "settingsGeneralPageLoaderQuery",
    "operationKind": "query",
    "text": "query settingsGeneralPageLoaderQuery {\n  ...DBUsagePieChart_data\n}\n\nfragment DBUsagePieChart_data on Query {\n  dbTableStats {\n    tableName\n    numBytes\n  }\n  dbStorageCapacityBytes\n}\n"
  }
};

(node as any).hash = "567b82d32463e4ba410f49c53bc9dcf2";

export default node;
