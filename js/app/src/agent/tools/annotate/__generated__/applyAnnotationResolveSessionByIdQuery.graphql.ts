/**
 * @generated SignedSource<<5c447e6b9fec52c15ebfff1b85d3f744>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type applyAnnotationResolveSessionByIdQuery$variables = {
  sessionId: string;
};
export type applyAnnotationResolveSessionByIdQuery$data = {
  readonly session: {
    readonly id: string;
  } | null;
};
export type applyAnnotationResolveSessionByIdQuery = {
  response: applyAnnotationResolveSessionByIdQuery$data;
  variables: applyAnnotationResolveSessionByIdQuery$variables;
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
        "name": "id",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "applyAnnotationResolveSessionByIdQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "applyAnnotationResolveSessionByIdQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "f08c3c031be234ddd7988c91258c08e8",
    "id": null,
    "metadata": {},
    "name": "applyAnnotationResolveSessionByIdQuery",
    "operationKind": "query",
    "text": "query applyAnnotationResolveSessionByIdQuery(\n  $sessionId: String!\n) {\n  session: getProjectSessionById(sessionId: $sessionId) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f7f7cc6b568caf8c65da23f3a04230d8";

export default node;
