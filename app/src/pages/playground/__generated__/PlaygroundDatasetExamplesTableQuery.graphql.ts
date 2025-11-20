/**
 * @generated SignedSource<<74c698c476dca5aa57dce81ff49a79c3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PlaygroundDatasetExamplesTableQuery$variables = {
  datasetId: string;
  splitIds?: ReadonlyArray<string> | null;
};
export type PlaygroundDatasetExamplesTableQuery$data = {
  readonly dataset: {
    readonly latestVersions?: {
      readonly edges: ReadonlyArray<{
        readonly version: {
          readonly id: string;
        };
      }>;
    };
    readonly " $fragmentSpreads": FragmentRefs<"PlaygroundDatasetExamplesTableFragment">;
  };
};
export type PlaygroundDatasetExamplesTableQuery = {
  response: PlaygroundDatasetExamplesTableQuery$data;
  variables: PlaygroundDatasetExamplesTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "splitIds"
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
  "kind": "Variable",
  "name": "splitIds",
  "variableName": "splitIds"
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
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
            (v3/*: any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": "versions(first:1,sort:{\"col\":\"createdAt\",\"dir\":\"desc\"})"
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v6 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 20
  },
  (v2/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundDatasetExamplesTableQuery",
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
            "args": [
              (v2/*: any*/)
            ],
            "kind": "FragmentSpread",
            "name": "PlaygroundDatasetExamplesTableFragment"
          },
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/)
            ],
            "type": "Dataset",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundDatasetExamplesTableQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v6/*: any*/),
                "concreteType": "DatasetExampleConnection",
                "kind": "LinkedField",
                "name": "examples",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetExampleEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "example",
                        "args": null,
                        "concreteType": "DatasetExample",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DatasetExampleRevision",
                            "kind": "LinkedField",
                            "name": "revision",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "input",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "output",
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
                        "kind": "ScalarField",
                        "name": "cursor",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DatasetExample",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v5/*: any*/),
                          (v3/*: any*/)
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
                "args": (v6/*: any*/),
                "filters": [
                  "datasetVersionId",
                  "splitIds"
                ],
                "handle": "connection",
                "key": "PlaygroundDatasetExamplesTable_examples",
                "kind": "LinkedHandle",
                "name": "examples"
              },
              (v4/*: any*/)
            ],
            "type": "Dataset",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "0eb9e2d6ec900fd20d2a5f082741dbf9",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableQuery",
    "operationKind": "query",
    "text": "query PlaygroundDatasetExamplesTableQuery(\n  $datasetId: ID!\n  $splitIds: [ID!]\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ...PlaygroundDatasetExamplesTableFragment_1Csera\n    ... on Dataset {\n      latestVersions: versions(first: 1, sort: {col: createdAt, dir: desc}) {\n        edges {\n          version: node {\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment PlaygroundDatasetExamplesTableFragment_1Csera on Dataset {\n  examples(splitIds: $splitIds, first: 20) {\n    edges {\n      example: node {\n        id\n        revision {\n          input\n          output\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "23aeaec8a7e6744ee5bbbf129d3547c2";

export default node;
