/**
 * @generated SignedSource<<ad134a4b98f1333dd970f8e0fb088382>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type resetPasswordLoaderQuery$variables = Record<PropertyKey, never>;
export type resetPasswordLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ResetPasswordFormQuery">;
};
export type resetPasswordLoaderQuery = {
  response: resetPasswordLoaderQuery$data;
  variables: resetPasswordLoaderQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "resetPasswordLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ResetPasswordFormQuery"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "resetPasswordLoaderQuery",
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
            "name": "email",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8e5dcd2c0c02f94806b7a00188affebd",
    "id": null,
    "metadata": {},
    "name": "resetPasswordLoaderQuery",
    "operationKind": "query",
    "text": "query resetPasswordLoaderQuery {\n  ...ResetPasswordFormQuery\n}\n\nfragment ResetPasswordFormQuery on Query {\n  viewer {\n    email\n    id\n  }\n}\n"
  }
};

(node as any).hash = "4112654a7409584973de84e8582f983b";

export default node;
