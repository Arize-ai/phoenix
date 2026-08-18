/**
 * @generated SignedSource<<fe30bf282bec44130c06428b3934b40c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type applyAnnotationResolveTraceByOtelIdQuery$variables = {
  traceId: string;
};
export type applyAnnotationResolveTraceByOtelIdQuery$data = {
  readonly trace: {
    readonly id: string;
  } | null;
};
export type applyAnnotationResolveTraceByOtelIdQuery = {
  response: applyAnnotationResolveTraceByOtelIdQuery$data;
  variables: applyAnnotationResolveTraceByOtelIdQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "traceId"
  }
],
v1 = [
  {
    "alias": "trace",
    "args": [
      {
        "kind": "Variable",
        "name": "traceId",
        "variableName": "traceId"
      }
    ],
    "concreteType": "Trace",
    "kind": "LinkedField",
    "name": "getTraceByOtelId",
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
    "name": "applyAnnotationResolveTraceByOtelIdQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "applyAnnotationResolveTraceByOtelIdQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "80379914085cabd541548a98c607612a",
    "id": null,
    "metadata": {},
    "name": "applyAnnotationResolveTraceByOtelIdQuery",
    "operationKind": "query",
    "text": "query applyAnnotationResolveTraceByOtelIdQuery(\n  $traceId: String!\n) {\n  trace: getTraceByOtelId(traceId: $traceId) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "2893a4acd0db0737f7884301ac816f73";

export default node;
