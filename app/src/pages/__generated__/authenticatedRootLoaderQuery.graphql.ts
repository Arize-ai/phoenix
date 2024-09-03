/**
 * @generated SignedSource<<62a352dc3c4b73bc1d24f7d9f8bf48f0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type authenticatedRootLoaderQuery$variables = Record<PropertyKey, never>;
export type authenticatedRootLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ViewerContext_viewer">;
};
export type authenticatedRootLoaderQuery = {
  response: authenticatedRootLoaderQuery$data;
  variables: authenticatedRootLoaderQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "authenticatedRootLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ViewerContext_viewer"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "authenticatedRootLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
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
            "name": "username",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "email",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "00470e5f67d2747f6ad5448af9d6bed4",
    "id": null,
    "metadata": {},
    "name": "authenticatedRootLoaderQuery",
    "operationKind": "query",
    "text": "query authenticatedRootLoaderQuery {\n  ...ViewerContext_viewer\n}\n\nfragment ViewerContext_viewer on Query {\n  viewer {\n    id\n    username\n    email\n  }\n}\n"
  }
};

(node as any).hash = "26f018608f21da07f218dbd5e9f3a989";

export default node;
