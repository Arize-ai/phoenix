/**
 * @generated SignedSource<<99238115743f2560f83049982eff610f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ManageDatasetSplitsDialogQuery$variables = Record<PropertyKey, never>;
export type ManageDatasetSplitsDialogQuery$data = {
  readonly datasetSplits: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly color: string;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type ManageDatasetSplitsDialogQuery = {
  response: ManageDatasetSplitsDialogQuery$data;
  variables: ManageDatasetSplitsDialogQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "DatasetSplitEdge",
    "kind": "LinkedField",
    "name": "edges",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetSplit",
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "color",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "cursor",
        "storageKey": null
      }
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "PageInfo",
    "kind": "LinkedField",
    "name": "pageInfo",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "endCursor",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "hasNextPage",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v1 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 200
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ManageDatasetSplitsDialogQuery",
    "selections": [
      {
        "alias": "datasetSplits",
        "args": null,
        "concreteType": "DatasetSplitConnection",
        "kind": "LinkedField",
        "name": "__ManageDatasetSplitsDialog_datasetSplits_connection",
        "plural": false,
        "selections": (v0/*: any*/),
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ManageDatasetSplitsDialogQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DatasetSplitConnection",
        "kind": "LinkedField",
        "name": "datasetSplits",
        "plural": false,
        "selections": (v0/*: any*/),
        "storageKey": "datasetSplits(first:200)"
      },
      {
        "alias": null,
        "args": (v1/*: any*/),
        "filters": null,
        "handle": "connection",
        "key": "ManageDatasetSplitsDialog_datasetSplits",
        "kind": "LinkedHandle",
        "name": "datasetSplits"
      }
    ]
  },
  "params": {
    "cacheID": "92aadb1e6034de31009e1f8c1538195e",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": null,
          "cursor": null,
          "direction": "forward",
          "path": [
            "datasetSplits"
          ]
        }
      ]
    },
    "name": "ManageDatasetSplitsDialogQuery",
    "operationKind": "query",
    "text": "query ManageDatasetSplitsDialogQuery {\n  datasetSplits(first: 200) {\n    edges {\n      node {\n        id\n        name\n        color\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9bcf1e46a3f2d672d00613ea78d6cbec";

export default node;
