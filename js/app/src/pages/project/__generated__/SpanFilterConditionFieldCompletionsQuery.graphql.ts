/**
 * @generated SignedSource<<1fd06317ff73f72710e80a9c6dad358b>>
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
    readonly traceAnnotationNames?: ReadonlyArray<string>;
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
      "name": "traceAnnotationNames",
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
    "cacheID": "7097a07cbfeffd516f53134b389138fc",
    "id": null,
    "metadata": {},
    "name": "SpanFilterConditionFieldCompletionsQuery",
    "operationKind": "query",
    "text": "query SpanFilterConditionFieldCompletionsQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      spanAnnotationNames\n      traceAnnotationNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "73365432f2f4974744562e2c0e6e25ed";

export default node;
