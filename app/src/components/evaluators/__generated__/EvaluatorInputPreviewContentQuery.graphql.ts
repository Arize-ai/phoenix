/**
 * @generated SignedSource<<b2c59ebdac40b66c582cebcf8aeee037>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorInputPreviewContentQuery$variables = {
  datasetId: string;
  hasDataset: boolean;
  splitIds?: ReadonlyArray<string> | null;
};
export type EvaluatorInputPreviewContentQuery$data = {
  readonly dataset?: {
    readonly examples?: {
      readonly edges: ReadonlyArray<{
        readonly example: {
          readonly id: string;
          readonly revision: {
            readonly " $fragmentSpreads": FragmentRefs<"utils_datasetExampleToEvaluatorInput_example">;
          };
        };
      }>;
    };
  };
};
export type EvaluatorInputPreviewContentQuery = {
  response: EvaluatorInputPreviewContentQuery$data;
  variables: EvaluatorInputPreviewContentQuery$variables;
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
  "name": "hasDataset"
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
v4 = [
  {
    "kind": "Variable",
    "name": "splitIds",
    "variableName": "splitIds"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = [
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
  }
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
    "name": "EvaluatorInputPreviewContentQuery",
    "selections": [
      {
        "condition": "hasDataset",
        "kind": "Condition",
        "passingValue": true,
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
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": (v4/*: any*/),
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
                                    "kind": "InlineDataFragmentSpread",
                                    "name": "utils_datasetExampleToEvaluatorInput_example",
                                    "selections": (v6/*: any*/),
                                    "args": null,
                                    "argumentDefinitions": []
                                  }
                                ],
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
                  }
                ],
                "type": "Dataset",
                "abstractKey": null
              }
            ],
            "storageKey": null
          }
        ]
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
    "name": "EvaluatorInputPreviewContentQuery",
    "selections": [
      {
        "condition": "hasDataset",
        "kind": "Condition",
        "passingValue": true,
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
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "__typename",
                "storageKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": (v4/*: any*/),
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
                                "selections": (v6/*: any*/),
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
                  }
                ],
                "type": "Dataset",
                "abstractKey": null
              },
              (v5/*: any*/)
            ],
            "storageKey": null
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "47f9143e469209f557ce04bf9673a335",
    "id": null,
    "metadata": {},
    "name": "EvaluatorInputPreviewContentQuery",
    "operationKind": "query",
    "text": "query EvaluatorInputPreviewContentQuery(\n  $datasetId: ID!\n  $splitIds: [ID!]\n  $hasDataset: Boolean!\n) {\n  dataset: node(id: $datasetId) @include(if: $hasDataset) {\n    __typename\n    ... on Dataset {\n      examples(splitIds: $splitIds) {\n        edges {\n          example: node {\n            id\n            revision {\n              ...utils_datasetExampleToEvaluatorInput_example\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment utils_datasetExampleToEvaluatorInput_example on DatasetExampleRevision {\n  input\n  output\n  metadata\n}\n"
  }
};
})();

(node as any).hash = "a3254e59326637fbcf797325f01c4e19";

export default node;
