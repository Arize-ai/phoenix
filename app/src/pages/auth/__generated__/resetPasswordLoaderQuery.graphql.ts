/**
 * @generated SignedSource<<32055673af7ec3c53997b6c49b8d6dff>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type resetPasswordLoaderQuery$variables = Record<PropertyKey, never>;
export type resetPasswordLoaderQuery$data = {
  readonly viewer: {
    readonly email: string;
    readonly id: string;
  } | null;
};
export type resetPasswordLoaderQuery = {
  response: resetPasswordLoaderQuery$data;
  variables: resetPasswordLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
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
        "name": "email",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "resetPasswordLoaderQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "resetPasswordLoaderQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "c97389cd896f3e1746d0adf67c759462",
    "id": null,
    "metadata": {},
    "name": "resetPasswordLoaderQuery",
    "operationKind": "query",
    "text": "query resetPasswordLoaderQuery {\n  viewer {\n    id\n    email\n  }\n}\n"
  }
};
})();

(node as any).hash = "ccd75708c3ba7c1b283f7858dfa8d20e";

export default node;
