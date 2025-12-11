/**
 * @generated SignedSource<<78aa9da84c5d0d46d84695c2a3028097>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type UnassignEvaluatorFromDatasetInput = {
  datasetEvaluatorId: string;
  datasetId: string;
};
export type UnassignDatasetEvaluatorDialogUnassignMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  datasetId: string;
  input: UnassignEvaluatorFromDatasetInput;
};
export type UnassignDatasetEvaluatorDialogUnassignMutation$data = {
  readonly unassignEvaluatorFromDataset: {
    readonly evaluator: {
      readonly id: string;
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
  "concreteType": "DatasetEvaluator",
  "kind": "LinkedField",
  "name": "evaluator",
  "plural": false,
  "selections": [
    (v5/*: any*/)
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
    "value": 100
  }
],
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
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
          (v6/*: any*/)
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
                  (v7/*: any*/),
                  (v5/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": (v8/*: any*/),
                        "concreteType": "DatasetEvaluatorConnection",
                        "kind": "LinkedField",
                        "name": "datasetEvaluators",
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
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "displayName",
                                    "storageKey": null
                                  },
                                  (v9/*: any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "evaluator",
                                    "plural": false,
                                    "selections": [
                                      (v7/*: any*/),
                                      (v5/*: any*/),
                                      (v10/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "kind",
                                        "storageKey": null
                                      },
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
                                      },
                                      (v9/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "isBuiltin",
                                        "storageKey": null
                                      },
                                      {
                                        "kind": "InlineFragment",
                                        "selections": [
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": "Prompt",
                                            "kind": "LinkedField",
                                            "name": "prompt",
                                            "plural": false,
                                            "selections": [
                                              (v5/*: any*/),
                                              (v10/*: any*/)
                                            ],
                                            "storageKey": null
                                          },
                                          {
                                            "alias": null,
                                            "args": null,
                                            "concreteType": "PromptVersionTag",
                                            "kind": "LinkedField",
                                            "name": "promptVersionTag",
                                            "plural": false,
                                            "selections": [
                                              (v10/*: any*/),
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
                                  },
                                  (v7/*: any*/)
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
                        "storageKey": "datasetEvaluators(first:100)"
                      },
                      {
                        "alias": null,
                        "args": (v8/*: any*/),
                        "filters": [
                          "sort",
                          "filter"
                        ],
                        "handle": "connection",
                        "key": "DatasetEvaluatorsTable_datasetEvaluators",
                        "kind": "LinkedHandle",
                        "name": "datasetEvaluators"
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
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "538c4ba70a7bc1faab836d460d64487f",
    "id": null,
    "metadata": {},
    "name": "UnassignDatasetEvaluatorDialogUnassignMutation",
    "operationKind": "mutation",
    "text": "mutation UnassignDatasetEvaluatorDialogUnassignMutation(\n  $input: UnassignEvaluatorFromDatasetInput!\n  $datasetId: ID!\n) {\n  unassignEvaluatorFromDataset(input: $input) {\n    query {\n      dataset: node(id: $datasetId) {\n        __typename\n        ...DatasetEvaluatorsTable_evaluators\n        id\n      }\n    }\n    evaluator {\n      id\n    }\n  }\n}\n\nfragment DatasetEvaluatorsTable_evaluators on Dataset {\n  datasetEvaluators(first: 100) {\n    edges {\n      node {\n        ...DatasetEvaluatorsTable_row\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment DatasetEvaluatorsTable_row on DatasetEvaluator {\n  id\n  displayName\n  updatedAt\n  evaluator {\n    __typename\n    id\n    name\n    kind\n    description\n    createdAt\n    updatedAt\n    isBuiltin\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "17721f3e27b845b19ccf36601c83f718";

export default node;
