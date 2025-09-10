/**
 * @generated SignedSource<<438890125493320563fbfa4214924473>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetColumn = "createdAt" | "name";
export type DatasetFilterColumn = "name";
export type SortDir = "asc" | "desc";
export type DatasetFilter = {
  col: DatasetFilterColumn;
  value: string;
};
export type DatasetSort = {
  col: DatasetColumn;
  dir: SortDir;
};
export type DatasetsTableDatasetsQuery$variables = {
  after?: string | null;
  filter?: DatasetFilter | null;
  first?: number | null;
  sort?: DatasetSort | null;
};
export type DatasetsTableDatasetsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DatasetsTable_datasets">;
};
export type DatasetsTableDatasetsQuery = {
  response: DatasetsTableDatasetsQuery$data;
  variables: DatasetsTableDatasetsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
  },
  {
    "defaultValue": 100,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": {
      "col": "createdAt",
      "dir": "desc"
    },
    "kind": "LocalArgument",
    "name": "sort"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  {
    "kind": "Variable",
    "name": "filter",
    "variableName": "filter"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  },
  {
    "kind": "Variable",
    "name": "sort",
    "variableName": "sort"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetsTableDatasetsQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "DatasetsTable_datasets"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DatasetsTableDatasetsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
              {
                "alias": null,
                "args": null,
                "concreteType": "Dataset",
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
                    "name": "description",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "metadata",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "createdAt",
                    "storageKey": null
                  },
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
                    "kind": "ScalarField",
                    "name": "experimentCount",
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
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v1/*: any*/),
        "filters": [
          "sort",
          "filter"
        ],
        "handle": "connection",
        "key": "DatasetsTable_datasets",
        "kind": "LinkedHandle",
        "name": "datasets"
      }
    ]
  },
  "params": {
    "cacheID": "08daa0d1d804707d650c0b689bcbd156",
    "id": null,
    "metadata": {},
    "name": "DatasetsTableDatasetsQuery",
    "operationKind": "query",
    "text": "query DatasetsTableDatasetsQuery(\n  $after: String = null\n  $filter: DatasetFilter = null\n  $first: Int = 100\n  $sort: DatasetSort = {col: createdAt, dir: desc}\n) {\n  ...DatasetsTable_datasets_3JsJJ3\n}\n\nfragment DatasetsTable_datasets_3JsJJ3 on Query {\n  datasets(first: $first, after: $after, sort: $sort, filter: $filter) {\n    edges {\n      node {\n        id\n        name\n        description\n        metadata\n        createdAt\n        exampleCount\n        experimentCount\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7e2060873b57927f5b7eac64411dbc94";

export default node;
