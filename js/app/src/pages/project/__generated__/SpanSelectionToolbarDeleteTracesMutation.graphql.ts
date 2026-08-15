/**
 * @generated SignedSource<<3b8afb9201b32f7e486be9c4a74cbc26>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SpanSelectionToolbarDeleteTracesMutation$variables = {
  traceIds: ReadonlyArray<string>;
};
export type SpanSelectionToolbarDeleteTracesMutation$data = {
  readonly deleteTraces: {
    readonly __typename: "Query";
  };
};
export type SpanSelectionToolbarDeleteTracesMutation = {
  response: SpanSelectionToolbarDeleteTracesMutation$data;
  variables: SpanSelectionToolbarDeleteTracesMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "traceIds"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "traceIds",
        "variableName": "traceIds"
      }
    ],
    "concreteType": "Query",
    "kind": "LinkedField",
    "name": "deleteTraces",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
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
    "name": "SpanSelectionToolbarDeleteTracesMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SpanSelectionToolbarDeleteTracesMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "3e39d87554a43d8dc3006d3e977317e5",
    "id": null,
    "metadata": {},
    "name": "SpanSelectionToolbarDeleteTracesMutation",
    "operationKind": "mutation",
    "text": "mutation SpanSelectionToolbarDeleteTracesMutation(\n  $traceIds: [ID!]!\n) {\n  deleteTraces(traceIds: $traceIds) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "61f5b577eead8d4094340843ed9d8d28";

export default node;
