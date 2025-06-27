/**
 * @generated SignedSource<<fa65d1fff52504254bf82f340e0d603e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type traceRedirectLoaderQuery$variables = {
  traceOtelId: string;
};
export type traceRedirectLoaderQuery$data = {
  readonly trace: {
    readonly project: {
      readonly id: string;
    };
  } | null;
};
export type traceRedirectLoaderQuery = {
  response: traceRedirectLoaderQuery$data;
  variables: traceRedirectLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "traceOtelId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "traceId",
    "variableName": "traceOtelId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": [
    (v2/*: any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "traceRedirectLoaderQuery",
    "selections": [
      {
        "alias": "trace",
        "args": (v1/*: any*/),
        "concreteType": "Trace",
        "kind": "LinkedField",
        "name": "searchTraceByOtelId",
        "plural": false,
        "selections": [
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "traceRedirectLoaderQuery",
    "selections": [
      {
        "alias": "trace",
        "args": (v1/*: any*/),
        "concreteType": "Trace",
        "kind": "LinkedField",
        "name": "searchTraceByOtelId",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a64c2d8c8e876bd2b9d047bdbf63d844",
    "id": null,
    "metadata": {},
    "name": "traceRedirectLoaderQuery",
    "operationKind": "query",
    "text": "query traceRedirectLoaderQuery(\n  $traceOtelId: String!\n) {\n  trace: searchTraceByOtelId(traceId: $traceOtelId) {\n    project {\n      id\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e87a90ccfc3febb650672a34293a0693";

export default node;
