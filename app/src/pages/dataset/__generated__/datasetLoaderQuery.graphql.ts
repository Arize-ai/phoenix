/**
 * @generated SignedSource<<2ebe4417dce7427a6d0c9008a70a138c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type datasetLoaderQuery$variables = {
  id: string;
};
export type datasetLoaderQuery$data = {
  readonly dataset: {
    readonly description?: string | null;
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
    readonly name?: string;
    readonly " $fragmentSpreads": FragmentRefs<"DatasetExamplesTableFragment" | "DatasetExperimentsTableFragment">;
  };
};
export type datasetLoaderQuery = {
  response: datasetLoaderQuery$data;
  variables: datasetLoaderQuery$variables;
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
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
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
            (v2/*: any*/),
            (v4/*: any*/),
            (v5/*: any*/)
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
    "value": 100
  }
],
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v11 = [
  (v7/*: any*/)
],
v12 = {
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "datasetLoaderQuery",
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
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v6/*: any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DatasetExamplesTableFragment"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DatasetExperimentsTableFragment"
              }
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
    "name": "datasetLoaderQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*: any*/),
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v6/*: any*/),
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
                          (v2/*: any*/),
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
                              (v9/*: any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      (v10/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DatasetExample",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": (v11/*: any*/),
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  (v12/*: any*/)
                ],
                "storageKey": "examples(first:100)"
              },
              {
                "alias": null,
                "args": (v8/*: any*/),
                "filters": [
                  "datasetVersionId"
                ],
                "handle": "connection",
                "key": "DatasetExamplesTable_examples",
                "kind": "LinkedHandle",
                "name": "examples"
              },
              {
                "alias": null,
                "args": (v8/*: any*/),
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
                          (v2/*: any*/),
                          (v4/*: any*/),
                          (v5/*: any*/),
                          (v9/*: any*/)
                        ],
                        "storageKey": null
                      },
                      (v10/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Experiment",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": (v11/*: any*/),
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  (v12/*: any*/)
                ],
                "storageKey": "experiments(first:100)"
              },
              {
                "alias": null,
                "args": (v8/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "DatasetExperimentsTable_experiments",
                "kind": "LinkedHandle",
                "name": "experiments"
              }
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
    "cacheID": "19560b6abda8a29ba56658cec2089f72",
    "id": null,
    "metadata": {},
    "name": "datasetLoaderQuery",
    "operationKind": "query",
    "text": "query datasetLoaderQuery(\n  $id: GlobalID!\n) {\n  dataset: node(id: $id) {\n    __typename\n    id\n    ... on Dataset {\n      id\n      name\n      description\n      latestVersions: versions(first: 1, sort: {col: createdAt, dir: desc}) {\n        edges {\n          version: node {\n            id\n            description\n            createdAt\n          }\n        }\n      }\n      ...DatasetExamplesTableFragment\n      ...DatasetExperimentsTableFragment\n    }\n  }\n}\n\nfragment DatasetExamplesTableFragment on Dataset {\n  examples(first: 100) {\n    edges {\n      example: node {\n        id\n        revision {\n          input\n          output\n          metadata\n        }\n      }\n      cursor\n      node {\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment DatasetExperimentsTableFragment on Dataset {\n  experiments(first: 100) {\n    edges {\n      experiment: node {\n        id\n        description\n        createdAt\n        metadata\n      }\n      cursor\n      node {\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "1702fb612b4e93576fbc49b4bf6ec95c";

export default node;
