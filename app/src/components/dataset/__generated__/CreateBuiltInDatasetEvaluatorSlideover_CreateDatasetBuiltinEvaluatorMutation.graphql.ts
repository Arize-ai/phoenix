/**
 * @generated SignedSource<<f87ce6b695d7b2795b6436c6e9f80562>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CreateDatasetBuiltinEvaluatorInput = {
  datasetId: string;
  displayName: string;
  evaluatorId: string;
  inputMapping?: EvaluatorInputMappingInput | null;
};
export type EvaluatorInputMappingInput = {
  literalMapping?: any;
  pathMapping?: any;
};
export type CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  input: CreateDatasetBuiltinEvaluatorInput;
};
export type CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation$data = {
  readonly createDatasetBuiltinEvaluator: {
    readonly evaluator: {
      readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTable_row">;
    };
  };
};
export type CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation = {
  response: CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation$data;
  variables: CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation$variables;
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
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "displayName",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
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
  "name": "isBuiltin",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "Prompt",
  "kind": "LinkedField",
  "name": "prompt",
  "plural": false,
  "selections": [
    (v3/*: any*/),
    (v6/*: any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DatasetEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "createDatasetBuiltinEvaluator",
        "plural": false,
        "selections": [
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
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v3/*: any*/),
                      (v6/*: any*/),
                      (v7/*: any*/),
                      (v8/*: any*/),
                      (v9/*: any*/),
                      (v5/*: any*/),
                      (v10/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v11/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersionTag",
                            "kind": "LinkedField",
                            "name": "promptVersionTag",
                            "plural": false,
                            "selections": [
                              (v6/*: any*/)
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
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DatasetEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "createDatasetBuiltinEvaluator",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetEvaluator",
            "kind": "LinkedField",
            "name": "evaluator",
            "plural": false,
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
                  (v3/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v9/*: any*/),
                  (v5/*: any*/),
                  (v10/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v11/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersionTag",
                        "kind": "LinkedField",
                        "name": "promptVersionTag",
                        "plural": false,
                        "selections": [
                          (v6/*: any*/),
                          (v3/*: any*/)
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
                "kind": "Variable",
                "name": "connections",
                "variableName": "connectionIds"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "DatasetEvaluatorEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "dce1f02b97e22da7624c2b837256ddc3",
    "id": null,
    "metadata": {},
    "name": "CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation",
    "operationKind": "mutation",
    "text": "mutation CreateBuiltInDatasetEvaluatorSlideover_CreateDatasetBuiltinEvaluatorMutation(\n  $input: CreateDatasetBuiltinEvaluatorInput!\n) {\n  createDatasetBuiltinEvaluator(input: $input) {\n    evaluator {\n      ...DatasetEvaluatorsTable_row\n      id\n    }\n  }\n}\n\nfragment DatasetEvaluatorsTable_row on DatasetEvaluator {\n  id\n  displayName\n  updatedAt\n  evaluator {\n    __typename\n    id\n    name\n    kind\n    description\n    createdAt\n    updatedAt\n    isBuiltin\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "249829c3f4a0c6a7f32880a2f09f27e9";

export default node;
