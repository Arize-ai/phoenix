/**
 * @generated SignedSource<<03328136b479268126f8665940941f68>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type authenticatedRootLoader_viewerQuery$variables = Record<PropertyKey, never>;
export type authenticatedRootLoader_viewerQuery$data = {
  readonly viewer: {
    readonly email: string | null;
    readonly id: string;
    readonly passwordNeedsReset: boolean;
    readonly username: string;
  } | null;
};
export type authenticatedRootLoader_viewerQuery = {
  response: authenticatedRootLoader_viewerQuery$data;
  variables: authenticatedRootLoader_viewerQuery$variables;
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
        "name": "username",
        "storageKey": null
      },
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
        "name": "passwordNeedsReset",
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
    "name": "authenticatedRootLoader_viewerQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "authenticatedRootLoader_viewerQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "95ea890b5bfc0d438f83baa48f6980f4",
    "id": null,
    "metadata": {},
    "name": "authenticatedRootLoader_viewerQuery",
    "operationKind": "query",
    "text": "query authenticatedRootLoader_viewerQuery {\n  viewer {\n    id\n    username\n    email\n    passwordNeedsReset\n  }\n}\n"
  }
};
})();

(node as any).hash = "39590abe880df809f08308e4ed40604f";

export default node;
