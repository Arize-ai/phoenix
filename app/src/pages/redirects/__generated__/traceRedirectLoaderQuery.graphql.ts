/**
 * @generated SignedSource<<6c168e2885aedd4eb71a19eb3a1c0fd4>>
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
        "name": "getTraceByOtelId",
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
        "name": "getTraceByOtelId",
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
    "cacheID": "6e8acff3fd035f125c0a261b55f43015",
    "id": null,
    "metadata": {},
    "name": "traceRedirectLoaderQuery",
    "operationKind": "query",
    "text": "query traceRedirectLoaderQuery(\n  $traceOtelId: String!\n) {\n  trace: getTraceByOtelId(traceId: $traceOtelId) {\n    project {\n      id\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "4453100bcd3c636081232e19ee101eb9";

export default node;
