/**
 * @generated SignedSource<<3d3ee65a52cd71554c85b02a9f94e4d1>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type applySpanAnnotationsResolveByOtelIdQuery$variables = {
  spanId: string;
};
export type applySpanAnnotationsResolveByOtelIdQuery$data = {
  readonly span: {
    readonly id: string;
  } | null;
};
export type applySpanAnnotationsResolveByOtelIdQuery = {
  response: applySpanAnnotationsResolveByOtelIdQuery$data;
  variables: applySpanAnnotationsResolveByOtelIdQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "spanId"
  }
],
v1 = [
  {
    "alias": "span",
    "args": [
      {
        "kind": "Variable",
        "name": "spanId",
        "variableName": "spanId"
      }
    ],
    "concreteType": "Span",
    "kind": "LinkedField",
    "name": "getSpanByOtelId",
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
    "name": "applySpanAnnotationsResolveByOtelIdQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "applySpanAnnotationsResolveByOtelIdQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "6c7e6f2d2a1e6bf2ad1fdcaadbc96b62",
    "id": null,
    "metadata": {},
    "name": "applySpanAnnotationsResolveByOtelIdQuery",
    "operationKind": "query",
    "text": "query applySpanAnnotationsResolveByOtelIdQuery(\n  $spanId: String!\n) {\n  span: getSpanByOtelId(spanId: $spanId) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "dc25944393b6bc70dd2eda8d5a27e1a6";

export default node;
