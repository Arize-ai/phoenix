/**
 * @generated SignedSource<<5c5b4f14e508ee0fd4aae796aae997ef>>
 * @lightSyntaxTransform
 * @nogrep
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanSelectionToolbarDeleteTracesMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SpanSelectionToolbarDeleteTracesMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "eb52eb7c9b255069f86fde333d3c1c75",
    "id": null,
    "metadata": {},
    "name": "SpanSelectionToolbarDeleteTracesMutation",
    "operationKind": "mutation",
    "text": "mutation SpanSelectionToolbarDeleteTracesMutation(\n  $traceIds: [GlobalID!]!\n) {\n  deleteTraces(traceIds: $traceIds) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "5283cfa8a6e985223f13d95395852b17";

export default node;
