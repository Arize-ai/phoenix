/**
 * @generated SignedSource<<c147ffdebaa3780f82bcb4189a5691cc>>
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
    "name": "getProjectSessionByOtelId",
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
    "cacheID": "4bb8960df96b198310aada6cff07b536",
    "id": null,
    "metadata": {},
    "name": "sessionRedirectLoaderQuery",
    "operationKind": "query",
    "text": "query sessionRedirectLoaderQuery(\n  $sessionOtelId: String!\n) {\n  session: getProjectSessionByOtelId(sessionId: $sessionOtelId) {\n    projectId\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "a5fa7aeac5b76471c9ac7fcf2ae8e05f";

export default node;
