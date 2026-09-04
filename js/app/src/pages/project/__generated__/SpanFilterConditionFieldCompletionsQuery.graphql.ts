/**
 * @generated SignedSource<<f8f74699cea0cb97b569f270f46136f0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SpanFilterConditionFieldCompletionsQuery$variables = {
  id: string;
};
export type SpanFilterConditionFieldCompletionsQuery$data = {
  readonly project: {
    readonly spanAnnotationNames?: ReadonlyArray<string>;
    readonly traceAnnotationsNames?: ReadonlyArray<string>;
  };
};
export type SpanFilterConditionFieldCompletionsQuery = {
  response: SpanFilterConditionFieldCompletionsQuery$data;
  variables: SpanFilterConditionFieldCompletionsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "spanAnnotationNames",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "traceAnnotationsNames",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanFilterConditionFieldCompletionsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/)
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
    "name": "SpanFilterConditionFieldCompletionsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v2/*:: as any*/),
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
    ]
  },
  "params": {
    "cacheID": "8fbc0d55a070853915d60bfab32b1627",
    "id": null,
    "metadata": {},
    "name": "SpanFilterConditionFieldCompletionsQuery",
    "operationKind": "query",
    "text": "query SpanFilterConditionFieldCompletionsQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      spanAnnotationNames\n      traceAnnotationsNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "0c288ee7dbf8a31ce13c566f6bea327c";

export default node;
