/**
 * @generated SignedSource<<7f6b11d548f75d9e6b5e5263694c7da1>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageQuery$variables = {
  id: string;
};
export type ProjectPageQuery$data = {
  readonly project: {
    readonly evaluatorCount?: number;
    readonly name?: string;
    readonly " $fragmentSpreads": FragmentRefs<"ProjectTimeRangeControls_data">;
  };
};
export type ProjectPageQuery = {
  response: ProjectPageQuery$data;
  variables: ProjectPageQuery$variables;
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatorCount",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectPageQuery",
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
            "kind": "InlineFragment",
            "selections": [
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "ProjectTimeRangeControls_data"
              }
            ],
            "type": "Project",
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
    "name": "ProjectPageQuery",
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "streamingLastUpdatedAt",
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3713de301f1ca7016f37f625c4a86b82",
    "id": null,
    "metadata": {},
    "name": "ProjectPageQuery",
    "operationKind": "query",
    "text": "query ProjectPageQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      name\n      evaluatorCount\n      ...ProjectTimeRangeControls_data\n    }\n    id\n  }\n}\n\nfragment ProjectTimeRangeControls_data on Project {\n  streamingLastUpdatedAt\n  id\n}\n"
  }
};
})();

(node as any).hash = "17b0430cbb7a0b6ad24363e0985e35ee";

export default node;
