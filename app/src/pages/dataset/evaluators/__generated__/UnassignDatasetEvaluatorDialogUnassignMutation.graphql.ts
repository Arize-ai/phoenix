/**
 * @generated SignedSource<<6f788b5be03bf3e4ec249f4a988bff2f>>
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
      readonly " $fragmentSpreads": FragmentRefs<"EvaluatorsTable_row">;
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
  "name": "name",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v11 = [
  (v5/*: any*/),
  (v6/*: any*/)
],
v12 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Prompt",
      "kind": "LinkedField",
      "name": "prompt",
      "plural": false,
      "selections": (v11/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "pinnedPromptVersionId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptVersionTag",
      "kind": "LinkedField",
      "name": "promptVersionTag",
      "plural": false,
      "selections": (v11/*: any*/),
      "storageKey": null
    }
  ],
  "type": "LLMEvaluator",
  "abstractKey": null
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
v15 = [
  (v13/*: any*/),
  {
    "kind": "TypeDiscriminator",
    "abstractKey": "__isEvaluator"
  },
  (v5/*: any*/),
  (v6/*: any*/),
  (v7/*: any*/),
  (v8/*: any*/),
  (v9/*: any*/),
  (v10/*: any*/),
  (v12/*: any*/)
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
    "name": "UnassignDatasetEvaluatorDialogUnassignMutation",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "EvaluatorMutationPayload",
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
            "concreteType": null,
            "kind": "LinkedField",
            "name": "evaluator",
            "plural": false,
            "selections": [
              {
                "kind": "InlineDataFragmentSpread",
                "name": "EvaluatorsTable_row",
                "selections": [
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v9/*: any*/),
                  (v10/*: any*/),
                  (v12/*: any*/)
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
        "concreteType": "EvaluatorMutationPayload",
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
                        "concreteType": "EvaluatorConnection",
                        "kind": "LinkedField",
                        "name": "evaluators",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "EvaluatorEdge",
                            "kind": "LinkedField",
                            "name": "edges",
                            "plural": true,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "node",
                                "plural": false,
                                "selections": (v15/*: any*/),
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
            "concreteType": null,
            "kind": "LinkedField",
            "name": "evaluator",
            "plural": false,
            "selections": (v15/*: any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b5b81f12bbe1f3ee5112d1dfdebaa32a",
    "id": null,
    "metadata": {},
    "name": "UnassignDatasetEvaluatorDialogUnassignMutation",
    "operationKind": "mutation",
    "text": "mutation UnassignDatasetEvaluatorDialogUnassignMutation(\n  $input: UnassignEvaluatorFromDatasetInput!\n  $datasetId: ID!\n) {\n  unassignEvaluatorFromDataset(input: $input) {\n    query {\n      dataset: node(id: $datasetId) {\n        __typename\n        ...DatasetEvaluatorsTable_evaluators\n        id\n      }\n    }\n    evaluator {\n      __typename\n      ...EvaluatorsTable_row\n      id\n    }\n  }\n}\n\nfragment DatasetEvaluatorsTable_evaluators on Dataset {\n  evaluators(first: 100) {\n    edges {\n      node {\n        __typename\n        ...EvaluatorsTable_row\n        id\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n\nfragment EvaluatorsTable_row on Evaluator {\n  __isEvaluator: __typename\n  id\n  name\n  kind\n  description\n  createdAt\n  updatedAt\n  ... on LLMEvaluator {\n    prompt {\n      id\n      name\n    }\n    pinnedPromptVersionId\n    promptVersionTag {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "aeed74fab46524014e2d529214669644";

export default node;
