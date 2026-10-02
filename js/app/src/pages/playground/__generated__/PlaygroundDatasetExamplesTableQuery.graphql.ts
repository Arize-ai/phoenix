/**
 * @generated SignedSource<<64008ce61cac5437fb4a5c141ee4431b>>
 * @lightSyntaxTransform
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
    readonly exampleCount?: number;
    readonly latestVersions?: {
      readonly edges: ReadonlyArray<{
        readonly version: {
          readonly id: string;
        };
      }>;
    };
    readonly " $fragmentSpreads": FragmentRefs<"PlaygroundDatasetExamplesTableExpectedOutputsFragment" | "PlaygroundDatasetExamplesTableFragment">;
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
v3 = [
  (v2/*:: as any*/)
],
v4 = {
  "alias": null,
  "args": (v3/*:: as any*/),
  "kind": "ScalarField",
  "name": "exampleCount",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
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
            (v5/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": "versions(first:1,sort:{\"col\":\"createdAt\",\"dir\":\"desc\"})"
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v8 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 20
  },
  (v2/*:: as any*/)
],
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetExampleExpectedOutput",
  "kind": "LinkedField",
  "name": "expectedOutputs",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "annotationName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "label",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "score",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "explanation",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundDatasetExamplesTableQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": (v3/*:: as any*/),
            "kind": "FragmentSpread",
            "name": "PlaygroundDatasetExamplesTableFragment"
          },
          {
            "args": (v3/*:: as any*/),
            "kind": "FragmentSpread",
            "name": "PlaygroundDatasetExamplesTableExpectedOutputsFragment"
          },
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v6/*:: as any*/)
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "PlaygroundDatasetExamplesTableQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*:: as any*/),
          (v5/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v8/*:: as any*/),
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
                          (v5/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "externalId",
                            "storageKey": null
                          },
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
                                "name": "revisionId",
                                "storageKey": null
                              },
                              (v9/*:: as any*/)
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
                          (v7/*:: as any*/),
                          (v5/*:: as any*/)
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
                "args": (v8/*:: as any*/),
                "filters": [
                  "datasetVersionId",
                  "splitIds"
                ],
                "handle": "connection",
                "key": "PlaygroundDatasetExamplesTable_examples",
                "kind": "LinkedHandle",
                "name": "examples"
              },
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": "DatasetExampleExpectedOutputs",
                "kind": "LinkedField",
                "name": "exampleExpectedOutputs",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "exampleId",
                    "storageKey": null
                  },
                  (v9/*:: as any*/)
                ],
                "storageKey": null
              },
              (v6/*:: as any*/)
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
    "cacheID": "e19ac9d2a6f0e565bd681976773739b7",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableQuery",
    "operationKind": "query",
    "text": "query PlaygroundDatasetExamplesTableQuery(\n  $datasetId: ID!\n  $splitIds: [ID!]\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ...PlaygroundDatasetExamplesTableFragment_1Csera\n    ...PlaygroundDatasetExamplesTableExpectedOutputsFragment_1Csera\n    ... on Dataset {\n      exampleCount(splitIds: $splitIds)\n      latestVersions: versions(first: 1, sort: {col: createdAt, dir: desc}) {\n        edges {\n          version: node {\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment PlaygroundDatasetExamplesTableExpectedOutputsFragment_1Csera on Dataset {\n  exampleCount(splitIds: $splitIds)\n  exampleExpectedOutputs(splitIds: $splitIds) {\n    exampleId\n    expectedOutputs {\n      annotationName\n      label\n      score\n      explanation\n    }\n  }\n  id\n}\n\nfragment PlaygroundDatasetExamplesTableFragment_1Csera on Dataset {\n  examples(splitIds: $splitIds, first: 20) {\n    edges {\n      example: node {\n        id\n        externalId\n        revision {\n          input\n          output\n          metadata\n          revisionId\n          expectedOutputs {\n            annotationName\n            label\n            score\n            explanation\n          }\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "dfc712c9bd67a66a18dfa149d2c2a35b";

export default node;
