/**
 * @generated SignedSource<<34a695678c0ffd7d73fea7191011ea2b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type UpdateDatasetBuiltinEvaluatorInput = {
  datasetEvaluatorId: string;
  description?: string | null;
  inputMapping?: EvaluatorInputMappingInput | null;
  name: string;
  outputConfigOverride?: AnnotationConfigOverrideInput | null;
};
export type EvaluatorInputMappingInput = {
  literalMapping?: any;
  pathMapping?: any;
};
export type AnnotationConfigOverrideInput = {
  categorical?: CategoricalAnnotationConfigOverrideInput | null;
  continuous?: ContinuousAnnotationConfigOverrideInput | null;
};
export type CategoricalAnnotationConfigOverrideInput = {
  optimizationDirection?: OptimizationDirection | null;
  values?: ReadonlyArray<CategoricalAnnotationConfigValueInput> | null;
};
export type CategoricalAnnotationConfigValueInput = {
  label: string;
  score?: number | null;
};
export type ContinuousAnnotationConfigOverrideInput = {
  lowerBound?: number | null;
  optimizationDirection?: OptimizationDirection | null;
  upperBound?: number | null;
};
export type EditBuiltInDatasetEvaluatorSlideover_UpdateDatasetBuiltinEvaluatorMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  input: UpdateDatasetBuiltinEvaluatorInput;
};
export type EditBuiltInDatasetEvaluatorSlideover_UpdateDatasetBuiltinEvaluatorMutation$data = {
  readonly updateDatasetBuiltinEvaluator: {
    readonly evaluator: {
      readonly " $fragmentSpreads": FragmentRefs<"BuiltInDatasetEvaluatorDetails_datasetEvaluator" | "DatasetEvaluatorsTable_row" | "PlaygroundDatasetSection_evaluator">;
    };
  };
};
export type EditBuiltInDatasetEvaluatorSlideover_UpdateDatasetBuiltinEvaluatorMutation = {
  response: EditBuiltInDatasetEvaluatorSlideover_UpdateDatasetBuiltinEvaluatorMutation$data;
  variables: EditBuiltInDatasetEvaluatorSlideover_UpdateDatasetBuiltinEvaluatorMutation$variables;
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
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
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
  "concreteType": "Prompt",
  "kind": "LinkedField",
  "name": "prompt",
  "plural": false,
  "selections": [
    (v3/*: any*/),
    (v4/*: any*/)
  ],
  "storageKey": null
},
v12 = [
  (v4/*: any*/)
],
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluatorInputMapping",
  "kind": "LinkedField",
  "name": "inputMapping",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "literalMapping",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "pathMapping",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isBuiltin",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "concreteType": "CategoricalAnnotationValue",
  "kind": "LinkedField",
  "name": "values",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "label",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "score",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v17 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*: any*/),
    (v15/*: any*/),
    (v16/*: any*/)
  ],
  "type": "CategoricalAnnotationConfig",
  "abstractKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v20 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*: any*/),
    (v15/*: any*/),
    (v18/*: any*/),
    (v19/*: any*/)
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v22 = {
  "kind": "InlineFragment",
  "selections": (v12/*: any*/),
  "type": "AnnotationConfigBase",
  "abstractKey": "__isAnnotationConfigBase"
},
v23 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*: any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditBuiltInDatasetEvaluatorSlideover_UpdateDatasetBuiltinEvaluatorMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DatasetEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "updateDatasetBuiltinEvaluator",
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
                  (v6/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "user",
                    "plural": false,
                    "selections": [
                      (v7/*: any*/),
                      (v8/*: any*/)
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
                      (v3/*: any*/),
                      (v4/*: any*/),
                      (v9/*: any*/),
                      (v10/*: any*/),
                      (v6/*: any*/),
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
                            "selections": (v12/*: any*/),
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
              },
              {
                "kind": "InlineDataFragmentSpread",
                "name": "PlaygroundDatasetSection_evaluator",
                "selections": [
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v13/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v3/*: any*/),
                      (v9/*: any*/),
                      (v14/*: any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "outputConfig",
                    "plural": false,
                    "selections": [
                      (v17/*: any*/),
                      (v20/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "args": null,
                "argumentDefinitions": []
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "BuiltInDatasetEvaluatorDetails_datasetEvaluator"
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
    "name": "EditBuiltInDatasetEvaluatorSlideover_UpdateDatasetBuiltinEvaluatorMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "DatasetEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "updateDatasetBuiltinEvaluator",
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
              (v6/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v3/*: any*/)
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
                  (v21/*: any*/),
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v9/*: any*/),
                  (v10/*: any*/),
                  (v6/*: any*/),
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
                          (v4/*: any*/),
                          (v3/*: any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "LLMEvaluator",
                    "abstractKey": null
                  },
                  (v14/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "outputConfig",
                        "plural": false,
                        "selections": [
                          (v21/*: any*/),
                          (v22/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v15/*: any*/),
                              (v16/*: any*/)
                            ],
                            "type": "CategoricalAnnotationConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v15/*: any*/),
                              (v18/*: any*/),
                              (v19/*: any*/)
                            ],
                            "type": "ContinuousAnnotationConfig",
                            "abstractKey": null
                          },
                          (v23/*: any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "BuiltInEvaluator",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              },
              (v13/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "outputConfig",
                "plural": false,
                "selections": [
                  (v21/*: any*/),
                  (v17/*: any*/),
                  (v20/*: any*/),
                  (v23/*: any*/),
                  (v22/*: any*/)
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
    "cacheID": "5f5d5ad3f1cd852fb468051ec09888a6",
    "id": null,
    "metadata": {},
    "name": "EditBuiltInDatasetEvaluatorSlideover_UpdateDatasetBuiltinEvaluatorMutation",
    "operationKind": "mutation",
    "text": "mutation EditBuiltInDatasetEvaluatorSlideover_UpdateDatasetBuiltinEvaluatorMutation(\n  $input: UpdateDatasetBuiltinEvaluatorInput!\n) {\n  updateDatasetBuiltinEvaluator(input: $input) {\n    evaluator {\n      ...DatasetEvaluatorsTable_row\n      ...PlaygroundDatasetSection_evaluator\n      ...BuiltInDatasetEvaluatorDetails_datasetEvaluator\n      id\n    }\n  }\n}\n\nfragment BuiltInDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {\n  id\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  outputConfig {\n    __typename\n    ... on AnnotationConfigBase {\n      __isAnnotationConfigBase: __typename\n      name\n    }\n    ... on CategoricalAnnotationConfig {\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  evaluator {\n    __typename\n    kind\n    name\n    ... on BuiltInEvaluator {\n      outputConfig {\n        __typename\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n        }\n        ... on CategoricalAnnotationConfig {\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          optimizationDirection\n          lowerBound\n          upperBound\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment DatasetEvaluatorsTable_row on DatasetEvaluator {\n  id\n  name\n  description\n  updatedAt\n  user {\n    username\n    profilePictureUrl\n    id\n  }\n  evaluator {\n    __typename\n    id\n    name\n    kind\n    createdAt\n    updatedAt\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n    }\n  }\n}\n\nfragment PlaygroundDatasetSection_evaluator on DatasetEvaluator {\n  id\n  name\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  evaluator {\n    __typename\n    id\n    kind\n    isBuiltin\n  }\n  outputConfig {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4c649cf59e097538b875c8856550d1c6";

export default node;
