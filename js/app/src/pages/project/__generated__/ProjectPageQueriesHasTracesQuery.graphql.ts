/**
 * @generated SignedSource<<fb850aa63fafcd14151b9ff3ca434f4b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectPageQueriesHasTracesQuery$variables = {
  id: string;
};
export type ProjectPageQueriesHasTracesQuery$data = {
  readonly project: {
    readonly hasTraces?: boolean;
  };
};
export type ProjectPageQueriesHasTracesQuery = {
  response: ProjectPageQueriesHasTracesQuery$data;
  variables: ProjectPageQueriesHasTracesQuery$variables;
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
      "name": "hasTraces",
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
    "name": "ProjectPageQueriesHasTracesQuery",
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
    "name": "ProjectPageQueriesHasTracesQuery",
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
    "cacheID": "10032f258ce7a605cb84b0c42ddd5a8c",
    "id": null,
    "metadata": {},
    "name": "ProjectPageQueriesHasTracesQuery",
    "operationKind": "query",
    "text": "query ProjectPageQueriesHasTracesQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      hasTraces\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "258e8c13a4c1f75ea5e0723aaa0fac65";

export default node;
