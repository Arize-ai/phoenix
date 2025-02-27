/**
 * @generated SignedSource<<0f8aa82184ff460da4272ab89803f826>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type datasetStore_latestVersionQuery$variables = {
  datasetId: string;
};
export type datasetStore_latestVersionQuery$data = {
  readonly dataset: {
    readonly id: string;
    readonly latestVersions?: {
      readonly edges: ReadonlyArray<{
        readonly version: {
          readonly createdAt: string;
          readonly description: string | null;
          readonly id: string;
        };
      }>;
    };
  };
};
export type datasetStore_latestVersionQuery = {
  response: datasetStore_latestVersionQuery$data;
  variables: datasetStore_latestVersionQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "latestVersions",
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 1
        },
        {
          "kind": "Literal",
          "name": "sort",
          "value": {
            "col": "createdAt",
            "dir": "desc"
          }
        }
      ],
      "concreteType": "DatasetVersionConnection",
      "kind": "LinkedField",
      "name": "versions",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DatasetVersionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "version",
              "args": null,
              "concreteType": "DatasetVersion",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v2/*: any*/),
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
                  "name": "createdAt",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "versions(first:1,sort:{\"col\":\"createdAt\",\"dir\":\"desc\"})"
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "datasetStore_latestVersionQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/)
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
    "name": "datasetStore_latestVersionQuery",
    "selections": [
      {
        "alias": "dataset",
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
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "d7075240e4dae8871997e57616c05302",
    "id": null,
    "metadata": {},
    "name": "datasetStore_latestVersionQuery",
    "operationKind": "query",
    "text": "query datasetStore_latestVersionQuery(\n  $datasetId: GlobalID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      latestVersions: versions(first: 1, sort: {col: createdAt, dir: desc}) {\n        edges {\n          version: node {\n            id\n            description\n            createdAt\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a1349b92d8b0c745f5e8039c55b048c7";

export default node;
