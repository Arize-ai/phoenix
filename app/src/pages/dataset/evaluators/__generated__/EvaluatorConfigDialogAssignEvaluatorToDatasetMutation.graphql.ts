/**
 * @generated SignedSource<<cf224d80d94d099f9b5b9ed9a62e5998>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AssignEvaluatorToDatasetInput = {
  datasetId: string;
  evaluatorId: string;
};
export type EvaluatorConfigDialogAssignEvaluatorToDatasetMutation$variables = {
  datasetEvaluatorConnection: string;
  datasetId: string;
  input: AssignEvaluatorToDatasetInput;
};
export type EvaluatorConfigDialogAssignEvaluatorToDatasetMutation$data = {
  readonly assignEvaluatorToDataset: {
    readonly evaluator: {
      readonly " $fragmentSpreads": FragmentRefs<"EvaluatorsTable_row">;
    };
    readonly query: {
      readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsPage_evaluators">;
    };
  };
};
export type EvaluatorConfigDialogAssignEvaluatorToDatasetMutation = {
  response: EvaluatorConfigDialogAssignEvaluatorToDatasetMutation$data;
  variables: EvaluatorConfigDialogAssignEvaluatorToDatasetMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetEvaluatorConnection"
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
    "name": "datasetId",
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
v11 = {
  "alias": null,
  "args": (v4/*: any*/),
  "kind": "ScalarField",
  "name": "isAssignedToDataset",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
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
    "name": "EvaluatorConfigDialogAssignEvaluatorToDatasetMutation",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "EvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "assignEvaluatorToDataset",
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
                "args": (v4/*: any*/),
                "kind": "FragmentSpread",
                "name": "DatasetEvaluatorsPage_evaluators"
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
                  (v11/*: any*/)
                ],
                "args": (v4/*: any*/),
                "argumentDefinitions": [
                  (v1/*: any*/)
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
      (v2/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "EvaluatorConfigDialogAssignEvaluatorToDatasetMutation",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "EvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "assignEvaluatorToDataset",
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
                "alias": "globalEvaluators",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "first",
                    "value": 100
                  }
                ],
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
                        "selections": [
                          (v12/*: any*/),
                          (v5/*: any*/),
                          (v6/*: any*/),
                          (v7/*: any*/),
                          (v11/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "CategoricalAnnotationConfig",
                                "kind": "LinkedField",
                                "name": "outputConfig",
                                "plural": false,
                                "selections": [
                                  (v6/*: any*/),
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
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "evaluators(first:100)"
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
              (v12/*: any*/),
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
              (v11/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "appendNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "evaluator",
            "handleArgs": [
              {
                "items": [
                  {
                    "kind": "Variable",
                    "name": "connections.0",
                    "variableName": "datasetEvaluatorConnection"
                  }
                ],
                "kind": "ListValue",
                "name": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "EvaluatorEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "d953c2d62edafdba9e6e9cc504159056",
    "id": null,
    "metadata": {},
    "name": "EvaluatorConfigDialogAssignEvaluatorToDatasetMutation",
    "operationKind": "mutation",
    "text": "mutation EvaluatorConfigDialogAssignEvaluatorToDatasetMutation(\n  $input: AssignEvaluatorToDatasetInput!\n  $datasetId: ID!\n) {\n  assignEvaluatorToDataset(input: $input) {\n    query {\n      ...DatasetEvaluatorsPage_evaluators_1wYocp\n    }\n    evaluator {\n      __typename\n      ...EvaluatorsTable_row_1wYocp\n      id\n    }\n  }\n}\n\nfragment DatasetEvaluatorsPage_evaluators_1wYocp on Query {\n  globalEvaluators: evaluators(first: 100) {\n    edges {\n      node {\n        __typename\n        id\n        name\n        kind\n        isAssignedToDataset(datasetId: $datasetId)\n        ... on LLMEvaluator {\n          outputConfig {\n            name\n            id\n          }\n        }\n      }\n    }\n  }\n}\n\nfragment EvaluatorsTable_row_1wYocp on Evaluator {\n  __isEvaluator: __typename\n  id\n  name\n  kind\n  description\n  createdAt\n  updatedAt\n  isAssignedToDataset(datasetId: $datasetId)\n}\n"
  }
};
})();

(node as any).hash = "ad8e5da859bc27131593d87abfb86080";

export default node;
