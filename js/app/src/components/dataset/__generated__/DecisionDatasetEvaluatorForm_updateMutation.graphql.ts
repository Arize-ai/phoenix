/**
 * @generated SignedSource<<b5b7b747c8df391785012d2593ab0467>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionTemplateFormat = "F_STRING" | "MUSTACHE";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type UpdateDatasetDecisionEvaluatorInput = {
  datasetEvaluatorId: string;
  decisionVersion?: DecisionVersionInput | null;
  decisionVersionId?: string | null;
  description?: string | null;
  inputMapping?: EvaluatorInputMappingInput | null;
  name?: string | null;
  scoringPolicy?: DecisionScoringPolicyInput | null;
};
export type EvaluatorInputMappingInput = {
  literalMapping: any;
  pathMapping: any;
};
export type DecisionVersionInput = {
  customProviderId?: string | null;
  description?: string | null;
  inputs: ReadonlyArray<DecisionInputDefinitionInput>;
  metadata?: any | null;
  modelName: string;
  modelProvider: GenerativeProviderKey;
  questions: ReadonlyArray<DecisionQuestionInput>;
  state: DecisionStateInput;
};
export type DecisionInputDefinitionInput = {
  description?: string | null;
  jsonSchema?: any | null;
  name: string;
};
export type DecisionStateInput = {
  input?: never;
  object: boolean;
  text?: never;
} | {
  input?: never;
  object?: never;
  text: TextStateInput;
} | {
  input: string;
  object?: never;
  text?: never;
};
export type TextStateInput = {
  template: string;
  templateFormat: DecisionTemplateFormat;
};
export type DecisionQuestionInput = {
  choice?: never;
  predicate: PredicateQuestionInput;
  scale?: never;
} | {
  choice: ChoiceQuestionInput;
  predicate?: never;
  scale?: never;
} | {
  choice?: never;
  predicate?: never;
  scale: ScaleQuestionInput;
};
export type PredicateQuestionInput = {
  criteria?: PredicateCriteriaInput | null;
  instructions: string;
  name: string;
};
export type PredicateCriteriaInput = {
  false?: string | null;
  true?: string | null;
};
export type ChoiceQuestionInput = {
  choices: ReadonlyArray<ChoiceOptionInput>;
  instructions: string;
  name: string;
};
export type ChoiceOptionInput = {
  description?: string | null;
  value: string;
};
export type ScaleQuestionInput = {
  instructions: string;
  levels: ReadonlyArray<ScaleLevelInput>;
  name: string;
};
export type ScaleLevelInput = {
  description?: string | null;
  label: string;
};
export type DecisionScoringPolicyInput = {
  questions?: ReadonlyArray<DecisionQuestionScoringInput>;
};
export type DecisionQuestionScoringInput = {
  choice?: never;
  predicate: DecisionPredicateScoringInput;
  scale?: never;
} | {
  choice: DecisionChoiceScoringInput;
  predicate?: never;
  scale?: never;
} | {
  choice?: never;
  predicate?: never;
  scale: DecisionScaleScoringInput;
};
export type DecisionPredicateScoringInput = {
  name: string;
  optimizationDirection?: OptimizationDirection;
  threshold?: number;
};
export type DecisionChoiceScoringInput = {
  name: string;
  optimizationDirection?: OptimizationDirection;
  scores?: ReadonlyArray<DecisionChoiceScoreInput>;
};
export type DecisionChoiceScoreInput = {
  choice: string;
  score: number;
};
export type DecisionScaleScoringInput = {
  includeLabel?: boolean;
  name: string;
  optimizationDirection?: OptimizationDirection;
};
export type DecisionDatasetEvaluatorForm_updateMutation$variables = {
  input: UpdateDatasetDecisionEvaluatorInput;
};
export type DecisionDatasetEvaluatorForm_updateMutation$data = {
  readonly updateDatasetDecisionEvaluator: {
    readonly evaluator: {
      readonly description: string | null;
      readonly id: string;
      readonly inputMapping: {
        readonly literalMapping: any;
        readonly pathMapping: any;
      };
      readonly name: string;
      readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTable_row">;
    };
  };
};
export type DecisionDatasetEvaluatorForm_updateMutation = {
  response: DecisionDatasetEvaluatorForm_updateMutation$data;
  variables: DecisionDatasetEvaluatorForm_updateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v5 = {
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
    (v2/*:: as any*/),
    (v3/*:: as any*/)
  ],
  "storageKey": null
},
v12 = [
  (v3/*:: as any*/)
],
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "decisionId",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "language",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v18 = [
  (v3/*:: as any*/),
  (v2/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionDatasetEvaluatorForm_updateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DatasetEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "updateDatasetDecisionEvaluator",
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
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              {
                "kind": "InlineDataFragmentSpread",
                "name": "DatasetEvaluatorsTable_row",
                "selections": [
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v6/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "user",
                    "plural": false,
                    "selections": [
                      (v7/*:: as any*/),
                      (v8/*:: as any*/)
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
                      (v2/*:: as any*/),
                      (v3/*:: as any*/),
                      (v9/*:: as any*/),
                      (v10/*:: as any*/),
                      (v6/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v11/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersionTag",
                            "kind": "LinkedField",
                            "name": "promptVersionTag",
                            "plural": false,
                            "selections": (v12/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersion",
                            "kind": "LinkedField",
                            "name": "promptVersion",
                            "plural": false,
                            "selections": [
                              (v13/*:: as any*/),
                              (v14/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "LLMEvaluator",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DecisionVersion",
                            "kind": "LinkedField",
                            "name": "decisionVersion",
                            "plural": false,
                            "selections": [
                              (v2/*:: as any*/),
                              (v15/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "Decision",
                                "kind": "LinkedField",
                                "name": "decision",
                                "plural": false,
                                "selections": (v12/*:: as any*/),
                                "storageKey": null
                              },
                              (v13/*:: as any*/),
                              (v14/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "DecisionEvaluator",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v16/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SandboxConfig",
                            "kind": "LinkedField",
                            "name": "sandboxConfig",
                            "plural": false,
                            "selections": [
                              (v2/*:: as any*/),
                              (v3/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SandboxProvider",
                                "kind": "LinkedField",
                                "name": "provider",
                                "plural": false,
                                "selections": [
                                  (v17/*:: as any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "CodeEvaluator",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DecisionDatasetEvaluatorForm_updateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DatasetEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "updateDatasetDecisionEvaluator",
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
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v7/*:: as any*/),
                  (v8/*:: as any*/),
                  (v2/*:: as any*/)
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
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  (v9/*:: as any*/),
                  (v10/*:: as any*/),
                  (v6/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v11/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersionTag",
                        "kind": "LinkedField",
                        "name": "promptVersionTag",
                        "plural": false,
                        "selections": (v18/*:: as any*/),
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersion",
                        "kind": "LinkedField",
                        "name": "promptVersion",
                        "plural": false,
                        "selections": [
                          (v13/*:: as any*/),
                          (v14/*:: as any*/),
                          (v2/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "LLMEvaluator",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionVersion",
                        "kind": "LinkedField",
                        "name": "decisionVersion",
                        "plural": false,
                        "selections": [
                          (v2/*:: as any*/),
                          (v15/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Decision",
                            "kind": "LinkedField",
                            "name": "decision",
                            "plural": false,
                            "selections": (v18/*:: as any*/),
                            "storageKey": null
                          },
                          (v13/*:: as any*/),
                          (v14/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "DecisionEvaluator",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v16/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SandboxConfig",
                        "kind": "LinkedField",
                        "name": "sandboxConfig",
                        "plural": false,
                        "selections": [
                          (v2/*:: as any*/),
                          (v3/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SandboxProvider",
                            "kind": "LinkedField",
                            "name": "provider",
                            "plural": false,
                            "selections": [
                              (v17/*:: as any*/),
                              (v2/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "CodeEvaluator",
                    "abstractKey": null
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
    ]
  },
  "params": {
    "cacheID": "af3b0cce474847e3e9e7df27b6a2f95e",
    "id": null,
    "metadata": {},
    "name": "DecisionDatasetEvaluatorForm_updateMutation",
    "operationKind": "mutation",
    "text": "mutation DecisionDatasetEvaluatorForm_updateMutation(\n  $input: UpdateDatasetDecisionEvaluatorInput!\n) {\n  updateDatasetDecisionEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      description\n      inputMapping {\n        literalMapping\n        pathMapping\n      }\n      ...DatasetEvaluatorsTable_row\n    }\n  }\n}\n\nfragment DatasetEvaluatorsTable_row on DatasetEvaluator {\n  id\n  name\n  description\n  updatedAt\n  user {\n    username\n    profilePictureUrl\n    id\n  }\n  evaluator {\n    __typename\n    id\n    name\n    kind\n    createdAt\n    updatedAt\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        id\n      }\n    }\n    ... on DecisionEvaluator {\n      decisionVersion {\n        id\n        decisionId\n        decision {\n          name\n          id\n        }\n        modelName\n        modelProvider\n      }\n    }\n    ... on CodeEvaluator {\n      language\n      sandboxConfig {\n        id\n        name\n        provider {\n          backendType\n          id\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2b8e55419cd221ba068885eab926c051";

export default node;
