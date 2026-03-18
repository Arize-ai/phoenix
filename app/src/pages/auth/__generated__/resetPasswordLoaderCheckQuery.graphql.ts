/**
 * @generated SignedSource<<3fddc71cd98f7473c9948ca53d7b50cf>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type resetPasswordLoaderCheckQuery$variables = Record<PropertyKey, never>;
export type resetPasswordLoaderCheckQuery$data = {
  readonly viewer: {
    readonly id: string;
  } | null;
};
export type resetPasswordLoaderCheckQuery = {
  response: resetPasswordLoaderCheckQuery$data;
  variables: resetPasswordLoaderCheckQuery$variables;
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
    "name": "resetPasswordLoaderCheckQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "resetPasswordLoaderCheckQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "ba8c56b66e3cc3e3532c8d1755b9a529",
    "id": null,
    "metadata": {},
    "name": "resetPasswordLoaderCheckQuery",
    "operationKind": "query",
    "text": "query resetPasswordLoaderCheckQuery {\n  viewer {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "6ea3ab77033a9b2648ae2ab0797e0b0e";

export default node;
