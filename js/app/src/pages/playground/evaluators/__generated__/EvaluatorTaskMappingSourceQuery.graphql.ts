/**
 * @generated SignedSource<<093b3e3cc0b28907ec2cea2dde4ffeee>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorTaskMappingSourceQuery$variables = {
  datasetId: string;
  hasDataset: boolean;
  splitIds?: ReadonlyArray<string> | null;
};
export type EvaluatorTaskMappingSourceQuery$data = {
  readonly dataset?: {
    readonly examples?: {
      readonly edges: ReadonlyArray<{
        readonly example: {
          readonly revision: {
            readonly input: any;
            readonly metadata: any;
            readonly output: any;
          };
        };
      }>;
    };
  };
};
export type EvaluatorTaskMappingSourceQuery = {
  response: EvaluatorTaskMappingSourceQuery$data;
  variables: EvaluatorTaskMappingSourceQuery$variables;
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
    "kind": "Literal",
    "name": "first",
    "value": 1
  },
  {
    "kind": "Variable",
    "name": "splitIds",
    "variableName": "splitIds"
  }
],
v5 = {
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
    }
  ],
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorTaskMappingSourceQuery",
    "selections": [
      {
        "condition": "hasDataset",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "dataset",
            "args": (v3/*:: as any*/),
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
                    "args": (v4/*:: as any*/),
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
                              (v5/*:: as any*/)
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
      (v0/*:: as any*/),
      (v2/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "EvaluatorTaskMappingSourceQuery",
    "selections": [
      {
        "condition": "hasDataset",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "dataset",
            "args": (v3/*:: as any*/),
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
                    "args": (v4/*:: as any*/),
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
                              (v6/*:: as any*/)
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
              (v6/*:: as any*/)
            ],
            "storageKey": null
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "7c1c1dcb84e176ca76cd3a6eeeba8737",
    "id": null,
    "metadata": {},
    "name": "EvaluatorTaskMappingSourceQuery",
    "operationKind": "query",
    "text": "query EvaluatorTaskMappingSourceQuery(\n  $datasetId: ID!\n  $splitIds: [ID!]\n  $hasDataset: Boolean!\n) {\n  dataset: node(id: $datasetId) @include(if: $hasDataset) {\n    __typename\n    ... on Dataset {\n      examples(first: 1, splitIds: $splitIds) {\n        edges {\n          example: node {\n            revision {\n              input\n              output\n              metadata\n            }\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "561762fb4d3e4f341856150bc55888aa";

export default node;
