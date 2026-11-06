/**
 * @generated SignedSource<<e63eb879ee97e4b3fa34b47b1a14b262>>
 * @lightSyntaxTransform
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
    readonly project: {
      readonly id: string;
    };
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
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
        "concreteType": "Project",
        "kind": "LinkedField",
        "name": "project",
        "plural": false,
        "selections": [
          (v1/*:: as any*/)
        ],
        "storageKey": null
      },
      (v1/*:: as any*/)
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "sessionRedirectLoaderQuery",
    "selections": (v2/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "sessionRedirectLoaderQuery",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "a29a29b9a8b67c409b791500981cc75d",
    "id": null,
    "metadata": {},
    "name": "sessionRedirectLoaderQuery",
    "operationKind": "query",
    "text": "query sessionRedirectLoaderQuery(\n  $sessionId: String!\n) {\n  session: getProjectSessionById(sessionId: $sessionId) {\n    project {\n      id\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "a47554737ec41a895924c241c035078d";

export default node;
