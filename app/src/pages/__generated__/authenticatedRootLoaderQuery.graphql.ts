/**
 * @generated SignedSource<<e85d2d9b22f0e148a088a916d6082442>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type authenticatedRootLoaderQuery$variables = Record<PropertyKey, never>;
export type authenticatedRootLoaderQuery$data = {
  readonly viewer: {
    readonly email: string;
    readonly id: string;
    readonly passwordNeedsReset: boolean;
    readonly username: string;
  } | null;
  readonly " $fragmentSpreads": FragmentRefs<"ViewerContext_viewer">;
};
export type authenticatedRootLoaderQuery = {
  response: authenticatedRootLoaderQuery$data;
  variables: authenticatedRootLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "email",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "passwordNeedsReset",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
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
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/)
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
          (v0/*: any*/),
          (v1/*: any*/),
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "profilePictureUrl",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "isManagementUser",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "UserRole",
            "kind": "LinkedField",
            "name": "role",
            "plural": false,
            "selections": [
              (v4/*: any*/),
              (v0/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "authMethod",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "UserApiKey",
            "kind": "LinkedField",
            "name": "apiKeys",
            "plural": true,
            "selections": [
              (v0/*: any*/),
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "description",
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
                "name": "expiresAt",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "909f2b392805d784bcac384c6d208692",
    "id": null,
    "metadata": {},
    "name": "authenticatedRootLoaderQuery",
    "operationKind": "query",
    "text": "query authenticatedRootLoaderQuery {\n  ...ViewerContext_viewer\n  viewer {\n    id\n    username\n    email\n    passwordNeedsReset\n  }\n}\n\nfragment APIKeysTableFragment on User {\n  apiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n  id\n}\n\nfragment ViewerContext_viewer on Query {\n  viewer {\n    id\n    username\n    email\n    profilePictureUrl\n    isManagementUser\n    role {\n      name\n      id\n    }\n    authMethod\n    ...APIKeysTableFragment\n  }\n}\n"
  }
};
})();

(node as any).hash = "7df3b0168622116913f7d14b4a0a6a0a";

export default node;
