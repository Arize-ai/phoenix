/**
 * @generated SignedSource<<50593fc38166886b6f694885518e4c00>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type sessionRedirectLoaderQuery$variables = {
  sessionId: string;
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
    "name": "sessionId"
  }
],
v1 = [
  {
    "alias": "session",
    "args": [
      {
        "kind": "Variable",
        "name": "sessionId",
        "variableName": "sessionId"
      }
    ],
    "concreteType": "ProjectSession",
    "kind": "LinkedField",
    "name": "getProjectSessionById",
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
    "cacheID": "db3660ac192256a7757e3572b57899cb",
    "id": null,
    "metadata": {},
    "name": "sessionRedirectLoaderQuery",
    "operationKind": "query",
    "text": "query sessionRedirectLoaderQuery(\n  $sessionId: String!\n) {\n  session: getProjectSessionById(sessionId: $sessionId) {\n    projectId\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "55a0fc73eef2ceb3ec05e5dd36630eae";

export default node;
