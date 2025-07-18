/**
 * @generated SignedSource<<0415c1619b4db456898abbf9096c2958>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type settingsModelsLoaderQuery$variables = Record<PropertyKey, never>;
export type settingsModelsLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ModelsTable_generativeModels">;
};
export type settingsModelsLoaderQuery = {
  response: settingsModelsLoaderQuery$data;
  variables: settingsModelsLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "settingsModelsLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ModelsTable_generativeModels"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "settingsModelsLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "GenerativeModel",
        "kind": "LinkedField",
        "name": "generativeModels",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
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
            "name": "provider",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "namePattern",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "providerKey",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "startTime",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "createdAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "updatedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "lastUsedAt",
            "storageKey": null
          },
          (v0/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "TokenPrice",
            "kind": "LinkedField",
            "name": "tokenPrices",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "tokenType",
                "storageKey": null
              },
              (v0/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "costPerMillionTokens",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ddbc0e3917a3b7ca5beee5827e60b0e3",
    "id": null,
    "metadata": {},
    "name": "settingsModelsLoaderQuery",
    "operationKind": "query",
    "text": "query settingsModelsLoaderQuery {\n  ...ModelsTable_generativeModels\n}\n\nfragment ModelsTable_generativeModels on Query {\n  generativeModels {\n    id\n    name\n    provider\n    namePattern\n    providerKey\n    startTime\n    createdAt\n    updatedAt\n    lastUsedAt\n    kind\n    tokenPrices {\n      tokenType\n      kind\n      costPerMillionTokens\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a0f3a13e85b11b62ee06f77c3efabae7";

export default node;
