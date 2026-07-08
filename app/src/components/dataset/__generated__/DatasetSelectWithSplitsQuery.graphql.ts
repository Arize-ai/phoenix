/**
 * @generated SignedSource<<f7d7a1284fc69ca66e2b35905b6ff222>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetSelectWithSplitsQuery$variables = Record<PropertyKey, never>;
export type DatasetSelectWithSplitsQuery$data = {
  readonly datasets: {
    readonly edges: ReadonlyArray<{
      readonly dataset: {
        readonly exampleCount: number;
        readonly id: string;
        readonly labels: ReadonlyArray<{
          readonly color: string;
          readonly id: string;
          readonly name: string;
        }>;
        readonly name: string;
        readonly splits: ReadonlyArray<{
          readonly color: string;
          readonly id: string;
          readonly name: string;
        }>;
      };
    }>;
  };
};
export type DatasetSelectWithSplitsQuery = {
  response: DatasetSelectWithSplitsQuery$data;
  variables: DatasetSelectWithSplitsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = [
  (v0/*: any*/),
  (v1/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "color",
    "storageKey": null
  }
],
v3 = {
  "alias": "dataset",
  "args": null,
  "concreteType": "Dataset",
  "kind": "LinkedField",
  "name": "node",
  "plural": false,
  "selections": [
    (v0/*: any*/),
    (v1/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "exampleCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetSplit",
      "kind": "LinkedField",
      "name": "splits",
      "plural": true,
      "selections": (v2/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetLabel",
      "kind": "LinkedField",
      "name": "labels",
      "plural": true,
      "selections": (v2/*: any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v6 = {
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
},
v7 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetSelectWithSplitsQuery",
    "selections": [
      {
        "alias": "datasets",
        "args": null,
        "concreteType": "DatasetConnection",
        "kind": "LinkedField",
        "name": "__DatasetPickerWithSplits__datasets_connection",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Dataset",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v5/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v6/*: any*/)
        ],
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
    "name": "DatasetSelectWithSplitsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v7/*: any*/),
        "concreteType": "DatasetConnection",
        "kind": "LinkedField",
        "name": "datasets",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Dataset",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v5/*: any*/),
                  (v0/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v6/*: any*/)
        ],
        "storageKey": "datasets(first:100)"
      },
      {
        "alias": null,
        "args": (v7/*: any*/),
        "filters": null,
        "handle": "connection",
        "key": "DatasetPickerWithSplits__datasets",
        "kind": "LinkedHandle",
        "name": "datasets"
      }
    ]
  },
  "params": {
    "cacheID": "503acd64a4d082c873f59ab92110b8fb",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": null,
          "cursor": null,
          "direction": "forward",
          "path": [
            "datasets"
          ]
        }
      ]
    },
    "name": "DatasetSelectWithSplitsQuery",
    "operationKind": "query",
    "text": "query DatasetSelectWithSplitsQuery {\n  datasets(first: 100) {\n    edges {\n      dataset: node {\n        id\n        name\n        exampleCount\n        splits {\n          id\n          name\n          color\n        }\n        labels {\n          id\n          name\n          color\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a195ca2787d978a1363e3163082ef776";

export default node;
