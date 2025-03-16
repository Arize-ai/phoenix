/**
 * @generated SignedSource<<f9db3166ba7646bb93f6c49124466d9f>>
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
    "cacheID": "3f2aa2ea2629970ac6ca3c4fa86f1f7b",
    "id": null,
    "metadata": {},
    "name": "resetPasswordLoaderQuery",
    "operationKind": "query",
    "text": "query resetPasswordLoaderQuery {\n  viewer {\n    id\n    email\n  }\n  ...ResetPasswordFormQuery\n}\n\nfragment ResetPasswordFormQuery on Query {\n  viewer {\n    email\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "17bb397eaa3a44dd33996854e538f2ef";

export default node;
