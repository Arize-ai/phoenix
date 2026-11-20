/**
 * @generated SignedSource<<314335bec43904b3875a0260a8261baa>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectTimeRangeControlsRefetchQuery$variables = {
  id: string;
};
export type ProjectTimeRangeControlsRefetchQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectTimeRangeControls_data">;
  };
};
export type ProjectTimeRangeControlsRefetchQuery = {
  response: ProjectTimeRangeControlsRefetchQuery$data;
  variables: ProjectTimeRangeControlsRefetchQuery$variables;
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectTimeRangeControlsRefetchQuery",
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
            "args": null,
            "kind": "FragmentSpread",
            "name": "ProjectTimeRangeControls_data"
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
    "name": "ProjectTimeRangeControlsRefetchQuery",
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
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "streamingLastUpdatedAt",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "isClearingTraces",
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
    "cacheID": "f2f9adf1e83304fa66b7928657ee0775",
    "id": null,
    "metadata": {},
    "name": "ProjectTimeRangeControlsRefetchQuery",
    "operationKind": "query",
    "text": "query ProjectTimeRangeControlsRefetchQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...ProjectTimeRangeControls_data\n    id\n  }\n}\n\nfragment ProjectTimeRangeControls_data on Project {\n  streamingLastUpdatedAt\n  isClearingTraces\n  id\n}\n"
  }
};
})();

(node as any).hash = "82ed3c1fea90c3757e5c182c122f42f4";

export default node;
