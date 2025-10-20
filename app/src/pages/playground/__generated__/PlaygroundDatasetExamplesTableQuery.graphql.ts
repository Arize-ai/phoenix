/**
 * @generated SignedSource<<066eaaa567d8abff73ca1b8fa0044d02>>
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
  experimentIds?: ReadonlyArray<string> | null;
  splitIds?: ReadonlyArray<string> | null;
};
export type PlaygroundDatasetExamplesTableQuery$data = {
  readonly dataset: {
    readonly experiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly datasetVersionId: string;
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
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "experimentIds"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "splitIds"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v4 = {
  "kind": "Variable",
  "name": "splitIds",
  "variableName": "splitIds"
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "filterIds",
      "variableName": "experimentIds"
    }
  ],
  "concreteType": "ExperimentConnection",
  "kind": "LinkedField",
  "name": "experiments",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ExperimentEdge",
      "kind": "LinkedField",
      "name": "edges",
      "plural": true,
      "selections": [
        {
          "alias": "experiment",
          "args": null,
          "concreteType": "Experiment",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            (v5/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "datasetVersionId",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
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
  (v4/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundDatasetExamplesTableQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": [
              (v4/*: any*/)
            ],
            "kind": "FragmentSpread",
            "name": "PlaygroundDatasetExamplesTableFragment"
          },
          {
            "kind": "InlineFragment",
            "selections": [
              (v6/*: any*/)
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v2/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "PlaygroundDatasetExamplesTableQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*: any*/),
          (v5/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v8/*: any*/),
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
                          (v5/*: any*/),
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
                          (v7/*: any*/),
                          (v5/*: any*/)
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
                "args": (v8/*: any*/),
                "filters": [
                  "datasetVersionId",
                  "splitIds"
                ],
                "handle": "connection",
                "key": "PlaygroundDatasetExamplesTable_examples",
                "kind": "LinkedHandle",
                "name": "examples"
              },
              (v6/*: any*/)
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
    "cacheID": "d42834303870a54bb91edbba73ba5d82",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableQuery",
    "operationKind": "query",
    "text": "query PlaygroundDatasetExamplesTableQuery(\n  $datasetId: ID!\n  $splitIds: [ID!]\n  $experimentIds: [ID!]\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ...PlaygroundDatasetExamplesTableFragment_1Csera\n    ... on Dataset {\n      experiments(filterIds: $experimentIds) {\n        edges {\n          experiment: node {\n            id\n            datasetVersionId\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment PlaygroundDatasetExamplesTableFragment_1Csera on Dataset {\n  examples(splitIds: $splitIds, first: 20) {\n    edges {\n      example: node {\n        id\n        revision {\n          input\n          output\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "7051d0bddc572a073260d8fa08ccc1bd";

export default node;
