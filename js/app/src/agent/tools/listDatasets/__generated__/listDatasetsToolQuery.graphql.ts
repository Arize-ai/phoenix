/**
 * @generated SignedSource<<05446b2a52dbb18692106fb866e61696>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetFilterColumn = "name";
export type DatasetFilter = {
  col?: DatasetFilterColumn | null;
  filterLabels?: ReadonlyArray<string> | null;
  value?: string | null;
};
export type listDatasetsToolQuery$variables = {
  after?: string | null;
  filter?: DatasetFilter | null;
  first: number;
};
export type listDatasetsToolQuery$data = {
  readonly datasets: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly exampleCount: number;
        readonly id: string;
        readonly name: string;
      };
    }>;
    readonly pageInfo: {
      readonly endCursor: string | null;
      readonly hasNextPage: boolean;
    };
  };
};
export type listDatasetsToolQuery = {
  response: listDatasetsToolQuery$data;
  variables: listDatasetsToolQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "after"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filter"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v3 = [
  {
    "alias": null,
    "args": [
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
      }
    ],
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
                "name": "exampleCount",
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
            "name": "hasNextPage",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "endCursor",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "listDatasetsToolQuery",
    "selections": (v3/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*:: as any*/),
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "listDatasetsToolQuery",
    "selections": (v3/*:: as any*/)
  },
  "params": {
    "cacheID": "7ffd187e37c8dfa232f8182e4a27bfac",
    "id": null,
    "metadata": {},
    "name": "listDatasetsToolQuery",
    "operationKind": "query",
    "text": "query listDatasetsToolQuery(\n  $first: Int!\n  $after: String\n  $filter: DatasetFilter\n) {\n  datasets(first: $first, after: $after, filter: $filter) {\n    edges {\n      node {\n        id\n        name\n        exampleCount\n      }\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "df30771adfa78545d1556d9fdd16b09a";

export default node;
