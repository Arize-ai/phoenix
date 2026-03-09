/**
 * @generated SignedSource<<8a4c171657bc5502b5dc81fa47465354>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectPageOnboardingCountsQuery$variables = {
  id: string;
};
export type ProjectPageOnboardingCountsQuery$data = {
  readonly project: {
    readonly totalSpanCount?: number;
    readonly totalTraceCount?: number;
  };
};
export type ProjectPageOnboardingCountsQuery = {
  response: ProjectPageOnboardingCountsQuery$data;
  variables: ProjectPageOnboardingCountsQuery$variables;
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
      "alias": "totalTraceCount",
      "args": null,
      "kind": "ScalarField",
      "name": "traceCount",
      "storageKey": null
    },
    {
      "alias": "totalSpanCount",
      "args": null,
      "kind": "ScalarField",
      "name": "recordCount",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectPageOnboardingCountsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectPageOnboardingCountsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
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
          (v2/*: any*/),
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
    "cacheID": "956a1e019c47caf28335bd5200c58211",
    "id": null,
    "metadata": {},
    "name": "ProjectPageOnboardingCountsQuery",
    "operationKind": "query",
    "text": "query ProjectPageOnboardingCountsQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      totalTraceCount: traceCount\n      totalSpanCount: recordCount\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "13e620e3c862a6b5a2d520f37b117338";

export default node;
