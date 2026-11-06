/**
 * @generated SignedSource<<3d0a94139e3a474bfff58f98819c5252>>
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
  readonly viewer: {
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
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "id",
    "storageKey": null
  }
],
v2 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "User",
    "kind": "LinkedField",
    "name": "viewer",
    "plural": false,
    "selections": (v1/*:: as any*/),
    "storageKey": null
  },
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
    "selections": (v1/*:: as any*/),
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "applySpanAnnotationsResolveByOtelIdQuery",
    "selections": (v2/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "applySpanAnnotationsResolveByOtelIdQuery",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "9ec206854dbab5e4f5bf84330d287d32",
    "id": null,
    "metadata": {},
    "name": "applySpanAnnotationsResolveByOtelIdQuery",
    "operationKind": "query",
    "text": "query applySpanAnnotationsResolveByOtelIdQuery(\n  $spanId: String!\n) {\n  viewer {\n    id\n  }\n  span: getSpanByOtelId(spanId: $spanId) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "d3fa7d96818bf7c8a5a0911e1c1dd3fc";

export default node;
