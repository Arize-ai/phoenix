/**
 * @generated SignedSource<<854cb694fe40aa76e5a72131ef3ced86>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useSpanAnnotationNamesRefreshQuery$variables = {
  id: string;
};
export type useSpanAnnotationNamesRefreshQuery$data = {
  readonly node: {
    readonly spanAnnotationNames?: ReadonlyArray<string>;
    readonly traceAnnotationNames?: ReadonlyArray<string>;
  };
};
export type useSpanAnnotationNamesRefreshQuery = {
  response: useSpanAnnotationNamesRefreshQuery$data;
  variables: useSpanAnnotationNamesRefreshQuery$variables;
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
    "name": "useSpanAnnotationNamesRefreshQuery",
    "selections": [
      {
        "alias": null,
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
    "name": "useSpanAnnotationNamesRefreshQuery",
    "selections": [
      {
        "alias": null,
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
    "cacheID": "b3d6e8d646ab0f1299126fbe8aeda5e3",
    "id": null,
    "metadata": {},
    "name": "useSpanAnnotationNamesRefreshQuery",
    "operationKind": "query",
    "text": "query useSpanAnnotationNamesRefreshQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on Project {\n      spanAnnotationNames\n      traceAnnotationNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f896654869a3157c92d554ed48c96ef2";

export default node;
