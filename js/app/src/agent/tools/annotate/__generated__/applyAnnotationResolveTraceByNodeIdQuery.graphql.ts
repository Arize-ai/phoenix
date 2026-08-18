/**
 * @generated SignedSource<<46853175cdc994e944a1dcdacf5a8264>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type applyAnnotationResolveTraceByNodeIdQuery$variables = {
  traceNodeId: string;
};
export type applyAnnotationResolveTraceByNodeIdQuery$data = {
  readonly trace: {
    readonly __typename: "Trace";
    readonly id: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type applyAnnotationResolveTraceByNodeIdQuery = {
  response: applyAnnotationResolveTraceByNodeIdQuery$data;
  variables: applyAnnotationResolveTraceByNodeIdQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "traceNodeId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "traceNodeId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "applyAnnotationResolveTraceByNodeIdQuery",
    "selections": [
      {
        "alias": "trace",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/)
            ],
            "type": "Trace",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "applyAnnotationResolveTraceByNodeIdQuery",
    "selections": [
      {
        "alias": "trace",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2fd390f27ff7007b705676bef324e183",
    "id": null,
    "metadata": {},
    "name": "applyAnnotationResolveTraceByNodeIdQuery",
    "operationKind": "query",
    "text": "query applyAnnotationResolveTraceByNodeIdQuery(\n  $traceNodeId: ID!\n) {\n  trace: node(id: $traceNodeId) {\n    __typename\n    ... on Trace {\n      id\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "3ca3c92c34142918ecaafa27eb493226";

export default node;
