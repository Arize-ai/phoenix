/**
 * @generated SignedSource<<f841bed7b4ac7b2b3fc198476a8ede4b>>
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
v6 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v7 = {
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
              {
                "condition": "hasDataset",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  {
                    "alias": "dataset",
                    "args": (v6/*:: as any*/),
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v7/*:: as any*/)
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
              {
                "condition": "hasDataset",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  {
                    "alias": "dataset",
                    "args": (v6/*:: as any*/),
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
                      (v7/*:: as any*/),
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
    "cacheID": "aae8984eaca06e7240bc21d49417290c",
    "id": null,
    "metadata": {},
    "name": "useDeleteDatasetEvaluatorsMutation",
    "operationKind": "mutation",
    "text": "mutation useDeleteDatasetEvaluatorsMutation(\n  $input: DeleteDatasetEvaluatorsInput!\n  $datasetId: ID!\n  $hasDataset: Boolean!\n) {\n  deleteDatasetEvaluators(input: $input) {\n    datasetEvaluatorIds\n    query {\n      dataset: node(id: $datasetId) @include(if: $hasDataset) {\n        __typename\n        ... on Dataset {\n          evaluatorCount\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "94c8114f97cfe370d318d56c0c491c67";

export default node;
