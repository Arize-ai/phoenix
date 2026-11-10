/**
 * @generated SignedSource<<2fec20ee7295c0b260bae46765f50962>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteDatasetEvaluatorsInput = {
  datasetEvaluatorIds: ReadonlyArray<string>;
  deleteAssociatedPromptOrDecision?: boolean;
};
export type useDeleteDatasetEvaluatorsMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  datasetId: string;
  hasDataset: boolean;
  input: DeleteDatasetEvaluatorsInput;
};
export type useDeleteDatasetEvaluatorsMutation$data = {
  readonly deleteDatasetEvaluators: {
    readonly datasetEvaluatorIds: ReadonlyArray<string>;
    readonly query: {
      readonly dataset?: {
        readonly evaluatorCount?: number;
      };
      readonly datasetEvaluatorCount: number;
      readonly projectEvaluatorCount: number;
    };
  };
};
export type useDeleteDatasetEvaluatorsMutation = {
  response: useDeleteDatasetEvaluatorsMutation$data;
  variables: useDeleteDatasetEvaluatorsMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionIds"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasDataset"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v4 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "datasetEvaluatorIds",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectEvaluatorCount",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "datasetEvaluatorCount",
  "storageKey": null
},
v8 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v9 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluatorCount",
      "storageKey": null
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useDeleteDatasetEvaluatorsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v4/*:: as any*/),
        "concreteType": "DeleteDatasetEvaluatorsPayload",
        "kind": "LinkedField",
        "name": "deleteDatasetEvaluators",
        "plural": false,
        "selections": [
          (v5/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              {
                "condition": "hasDataset",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  {
                    "alias": "dataset",
                    "args": (v8/*:: as any*/),
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v9/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ]
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v3/*:: as any*/),
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "useDeleteDatasetEvaluatorsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v4/*:: as any*/),
        "concreteType": "DeleteDatasetEvaluatorsPayload",
        "kind": "LinkedField",
        "name": "deleteDatasetEvaluators",
        "plural": false,
        "selections": [
          (v5/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "deleteEdge",
            "key": "",
            "kind": "ScalarHandle",
            "name": "datasetEvaluatorIds",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connectionIds"
              }
            ]
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              {
                "condition": "hasDataset",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  {
                    "alias": "dataset",
                    "args": (v8/*:: as any*/),
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
                      (v9/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "id",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ]
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "af2b71de44d8cbfe8aae19e749060911",
    "id": null,
    "metadata": {},
    "name": "useDeleteDatasetEvaluatorsMutation",
    "operationKind": "mutation",
    "text": "mutation useDeleteDatasetEvaluatorsMutation(\n  $input: DeleteDatasetEvaluatorsInput!\n  $datasetId: ID!\n  $hasDataset: Boolean!\n) {\n  deleteDatasetEvaluators(input: $input) {\n    datasetEvaluatorIds\n    query {\n      projectEvaluatorCount\n      datasetEvaluatorCount\n      dataset: node(id: $datasetId) @include(if: $hasDataset) {\n        __typename\n        ... on Dataset {\n          evaluatorCount\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6df2e015cc2e2557074ee7685387f301";

export default node;
