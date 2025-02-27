/**
 * @generated SignedSource<<84f1f83de728fe14d012b3ec52afdca9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type resetPasswordLoaderQuery$variables = Record<PropertyKey, never>;
export type resetPasswordLoaderQuery$data = {
  readonly viewer: {
    readonly email: string;
    readonly id: string;
  } | null;
  readonly " $fragmentSpreads": FragmentRefs<"ResetPasswordFormQuery">;
};
export type resetPasswordLoaderQuery = {
  response: resetPasswordLoaderQuery$data;
  variables: resetPasswordLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
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
      "name": "email",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "resetPasswordLoaderQuery",
    "selections": [
      (v0/*: any*/),
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
      (v0/*: any*/)
    ]
  },
  "params": {
    "cacheID": "558e2fa85c0dc24da6318db9ebbd7958",
    "id": null,
    "metadata": {},
    "name": "resetPasswordLoaderQuery",
    "operationKind": "query",
    "text": "query resetPasswordLoaderQuery {\n  viewer {\n    id\n    email\n  }\n  ...ResetPasswordFormQuery\n}\n\nfragment ResetPasswordFormQuery on Query {\n  viewer {\n    email\n  }\n}\n"
  }
};
})();

(node as any).hash = "17bb397eaa3a44dd33996854e538f2ef";

export default node;
