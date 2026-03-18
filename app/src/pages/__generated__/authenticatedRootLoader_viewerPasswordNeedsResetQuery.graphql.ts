/**
 * @generated SignedSource<<9fda95cf7a2fe87a090485fa70525bb6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type authenticatedRootLoader_viewerPasswordNeedsResetQuery$variables = Record<PropertyKey, never>;
export type authenticatedRootLoader_viewerPasswordNeedsResetQuery$data = {
  readonly viewer: {
    readonly passwordNeedsReset: boolean;
  } | null;
};
export type authenticatedRootLoader_viewerPasswordNeedsResetQuery = {
  response: authenticatedRootLoader_viewerPasswordNeedsResetQuery$data;
  variables: authenticatedRootLoader_viewerPasswordNeedsResetQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "passwordNeedsReset",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "authenticatedRootLoader_viewerPasswordNeedsResetQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v0/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "authenticatedRootLoader_viewerPasswordNeedsResetQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v0/*: any*/),
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
    "cacheID": "c4557a1baa986359d3e6ba2d975bb37e",
    "id": null,
    "metadata": {},
    "name": "authenticatedRootLoader_viewerPasswordNeedsResetQuery",
    "operationKind": "query",
    "text": "query authenticatedRootLoader_viewerPasswordNeedsResetQuery {\n  viewer {\n    passwordNeedsReset\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "8bed3a6ba9bb51cd1c724bb3ed5ec289";

export default node;
