/**
 * @generated SignedSource<<a3880191f6603d2a79bad7228cad65d3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type UnassignEvaluatorFromDatasetInput = {
  datasetId: string;
  displayName: string;
  evaluatorId: string;
};
export type UnassignDatasetEvaluatorDialogUnassignMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  datasetId: string;
  input: UnassignEvaluatorFromDatasetInput;
};
export type UnassignDatasetEvaluatorDialogUnassignMutation$data = {
  readonly unassignEvaluatorFromDataset: {
    readonly evaluator: {
      readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTable_row">;
    };
    readonly query: {
      readonly dataset: {
        readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTable_evaluators">;
      };
    };
  };
};
export type UnassignDatasetEvaluatorDialogUnassignMutation = {
  response: UnassignDatasetEvaluatorDialogUnassignMutation$data;
  variables: UnassignDatasetEvaluatorDialogUnassignMutation$variables;
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
  "name": "input"
},
v3 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "displayName",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "Prompt",
  "kind": "LinkedField",
  "name": "prompt",
  "plural": false,
  "selections": [
    (v5/*: any*/),
    (v7/*: any*/)
  ],
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v14 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
],
v15 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "evaluator",
  "plural": false,
  "selections": [
    (v13/*: any*/),
    (v5/*: any*/),
    (v7/*: any*/),
    (v8/*: any*/),
    (v9/*: any*/),
    (v10/*: any*/),
    (v11/*: any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        (v12/*: any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptVersionTag",
          "kind": "LinkedField",
          "name": "promptVersionTag",
          "plural": false,
          "selections": [
            (v7/*: any*/),
            (v5/*: any*/)
          ],
          "storageKey": null
        }
      ],
      "type": "LLMEvaluator",
      "abstractKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "UnassignDatasetEvaluatorDialogUnassignMutation",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "DatasetEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "unassignEvaluatorFromDataset",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": "dataset",
                "args": (v4/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "DatasetEvaluatorsTable_evaluators"
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
            "concreteType": "DatasetEvaluator",
            "kind": "LinkedField",
            "name": "evaluator",
            "plural": false,
            "selections": [
              {
                "kind": "InlineDataFragmentSpread",
                "name": "DatasetEvaluatorsTable_row",
                "selections": [
                  (v5/*: any*/),
                  (v6/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v5/*: any*/),
                      (v7/*: any*/),
                      (v8/*: any*/),
                      (v9/*: any*/),
                      (v10/*: any*/),
                      (v11/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v12/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersionTag",
                            "kind": "LinkedField",
                            "name": "promptVersionTag",
                            "plural": false,
                            "selections": [
                              (v7/*: any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "LLMEvaluator",
                        "abstractKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
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
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "UnassignDatasetEvaluatorDialogUnassignMutation",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "DatasetEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "unassignEvaluatorFromDataset",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": "dataset",
                "args": (v4/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v13/*: any*/),
                  (v5/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": (v14/*: any*/),
                        "concreteType": "DatasetEvaluatorConnection",
                        "kind": "LinkedField",
                        "name": "evaluators",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DatasetEvaluatorEdge",
                            "kind": "LinkedField",
                            "name": "edges",
                            "plural": true,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "DatasetEvaluator",
                                "kind": "LinkedField",
                                "name": "node",
                                "plural": false,
                                "selections": [
                                  (v5/*: any*/),
                                  (v6/*: any*/),
                                  (v15/*: any*/),
                                  (v13/*: any*/)
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "cursor",
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
                          },
                          {
                            "kind": "ClientExtension",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "__id",
                                "storageKey": null
                              }
                            ]
                          }
                        ],
                        "storageKey": "evaluators(first:100)"
                      },
                      {
                        "alias": null,
                        "args": (v14/*: any*/),
                        "filters": [
                          "sort",
                          "filter"
                        ],
                        "handle": "connection",
                        "key": "DatasetEvaluatorsTable_evaluators",
                        "kind": "LinkedHandle",
                        "name": "evaluators"
                      }
                    ],
                    "type": "Dataset",
                    "abstractKey": null
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
            "concreteType": "DatasetEvaluator",
            "kind": "LinkedField",
            "name": "evaluator",
            "plural": false,
            "selections": [
              (v5/*: any*/),
              (v6/*: any*/),
              (v15/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "96b70bb2615d65f4a30068ba8b63a564",
    "id": null,
    "metadata": {},
    "name": "UnassignDatasetEvaluatorDialogUnassignMutation",
    "operationKind": "mutation",
    "text": "mutation UnassignDatasetEvaluatorDialogUnassignMutation(\n  $input: UnassignEvaluatorFromDatasetInput!\n  $datasetId: ID!\n) {\n  unassignEvaluatorFromDataset(input: $input) {\n    query {\n      dataset: node(id: $datasetId) {\n        __typename\n        ...DatasetEvaluatorsTable_evaluators\n        id\n      }\n    }\n    evaluator {\n      ...DatasetEvaluatorsTable_row\n      id\n    }\n  }\n}\n\nfragment DatasetEvaluatorsTable_evaluators on Dataset {\n  evaluators(first: 100) {\n    edges {\n      node {\n        ...DatasetEvaluatorsTable_row\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment DatasetEvaluatorsTable_row on DatasetEvaluator {\n  id\n  displayName\n  evaluator {\n    __typename\n    id\n    name\n    kind\n    description\n    createdAt\n    updatedAt\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f3148ec8d46f3d5f4a4e5ad131e9c1b4";

export default node;
