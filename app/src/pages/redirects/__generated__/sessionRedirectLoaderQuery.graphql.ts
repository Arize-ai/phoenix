/**
 * @generated SignedSource<<cd21e637d2725873c77638e5c46cf960>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type sessionRedirectLoaderQuery$variables = {
  sessionOtelId: string;
};
export type sessionRedirectLoaderQuery$data = {
  readonly session: {
    readonly id: string;
    readonly projectId: string;
  } | null;
};
export type sessionRedirectLoaderQuery = {
  response: sessionRedirectLoaderQuery$data;
  variables: sessionRedirectLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "sessionOtelId"
  }
],
v1 = [
  {
    "alias": "session",
    "args": [
      {
        "kind": "Variable",
        "name": "sessionId",
        "variableName": "sessionOtelId"
      }
    ],
    "concreteType": "ProjectSession",
    "kind": "LinkedField",
    "name": "searchSessionByOtelId",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "projectId",
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "sessionRedirectLoaderQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "sessionRedirectLoaderQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "bf8a102624e51df5521e3f235e565eee",
    "id": null,
    "metadata": {},
    "name": "sessionRedirectLoaderQuery",
    "operationKind": "query",
    "text": "query sessionRedirectLoaderQuery(\n  $sessionOtelId: String!\n) {\n  session: searchSessionByOtelId(sessionId: $sessionOtelId) {\n    projectId\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "32d76d6bdb19c5c0abbf7fc7fc4b2bb4";

export default node;
