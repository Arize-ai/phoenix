/**
 * @generated SignedSource<<fc3266ffad9af52be0379e9792d85a18>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type OAuth2ConsentPageQuery$variables = Record<PropertyKey, never>;
export type OAuth2ConsentPageQuery$data = {
  readonly viewer: {
    readonly email: string | null;
    readonly username: string;
  } | null;
};
export type OAuth2ConsentPageQuery = {
  response: OAuth2ConsentPageQuery$data;
  variables: OAuth2ConsentPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "email",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "OAuth2ConsentPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v0/*:: as any*/),
          (v1/*:: as any*/)
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
    "name": "OAuth2ConsentPageQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v0/*:: as any*/),
          (v1/*:: as any*/),
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
    "cacheID": "8d1f7ce2eb1c4849d09e84db42d9aae2",
    "id": null,
    "metadata": {},
    "name": "OAuth2ConsentPageQuery",
    "operationKind": "query",
    "text": "query OAuth2ConsentPageQuery {\n  viewer {\n    email\n    username\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "2ba2ecd3eebd1180c7ebd475b9a847e5";

export default node;
