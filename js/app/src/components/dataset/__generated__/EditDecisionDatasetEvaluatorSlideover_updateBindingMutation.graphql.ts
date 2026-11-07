/**
 * @generated SignedSource<<c89ab0f319212513672658f3fddeb99c>>
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
export type EditDecisionDatasetEvaluatorSlideover_updateBindingMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  input: UpdateDatasetDecisionEvaluatorInput;
};
export type EditDecisionDatasetEvaluatorSlideover_updateBindingMutation$data = {
  readonly updateDatasetDecisionEvaluator: {
    readonly evaluator: {
      readonly description: string | null;
      readonly id: string;
      readonly name: string;
      readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTable_row" | "DecisionDatasetEvaluatorDetails_datasetEvaluator" | "PlaygroundDatasetSection_evaluator">;
    };
  };
};
export type EditDecisionDatasetEvaluatorSlideover_updateBindingMutation = {
  response: EditDecisionDatasetEvaluatorSlideover_updateBindingMutation$data;
  variables: EditDecisionDatasetEvaluatorSlideover_updateBindingMutation$variables;
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
    (v3/*:: as any*/),
    (v4/*:: as any*/)
  ],
  "storageKey": null
},
v12 = [
  (v4/*:: as any*/)
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
  "name": "sequenceNumber",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "language",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v19 = {
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
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isBuiltin",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v25 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v22/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "CategoricalAnnotationValue",
      "kind": "LinkedField",
      "name": "values",
      "plural": true,
      "selections": [
        (v23/*:: as any*/),
        (v24/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "CategoricalAnnotationConfig",
  "abstractKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v28 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v22/*:: as any*/),
    (v26/*:: as any*/),
    (v27/*:: as any*/)
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "threshold",
  "storageKey": null
},
v30 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v22/*:: as any*/),
    (v29/*:: as any*/),
    (v26/*:: as any*/),
    (v27/*:: as any*/)
  ],
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
},
v31 = [
  (v4/*:: as any*/),
  (v3/*:: as any*/)
],
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "instructions",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditDecisionDatasetEvaluatorSlideover_updateBindingMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
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
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              {
                "kind": "InlineDataFragmentSpread",
                "name": "DatasetEvaluatorsTable_row",
                "selections": [
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
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
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
                              (v3/*:: as any*/),
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
                              (v16/*:: as any*/),
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
                          (v17/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SandboxConfig",
                            "kind": "LinkedField",
                            "name": "sandboxConfig",
                            "plural": false,
                            "selections": [
                              (v3/*:: as any*/),
                              (v4/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SandboxProvider",
                                "kind": "LinkedField",
                                "name": "provider",
                                "plural": false,
                                "selections": [
                                  (v18/*:: as any*/)
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
              },
              {
                "kind": "InlineDataFragmentSpread",
                "name": "PlaygroundDatasetSection_evaluator",
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v19/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v3/*:: as any*/),
                      (v9/*:: as any*/),
                      (v20/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "outputConfigs",
                    "plural": true,
                    "selections": [
                      (v21/*:: as any*/),
                      (v25/*:: as any*/),
                      (v28/*:: as any*/),
                      (v30/*:: as any*/)
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
                "name": "DecisionDatasetEvaluatorDetails_datasetEvaluator"
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
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "EditDecisionDatasetEvaluatorSlideover_updateBindingMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
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
                  (v3/*:: as any*/)
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
                  (v21/*:: as any*/),
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
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
                        "selections": (v31/*:: as any*/),
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
                          (v3/*:: as any*/)
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
                          (v3/*:: as any*/),
                          (v15/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Decision",
                            "kind": "LinkedField",
                            "name": "decision",
                            "plural": false,
                            "selections": (v31/*:: as any*/),
                            "storageKey": null
                          },
                          (v16/*:: as any*/),
                          (v13/*:: as any*/),
                          (v14/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DecisionInputDefinition",
                            "kind": "LinkedField",
                            "name": "inputs",
                            "plural": true,
                            "selections": [
                              (v4/*:: as any*/),
                              (v5/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "questions",
                            "plural": true,
                            "selections": [
                              (v21/*:: as any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v4/*:: as any*/),
                                  (v32/*:: as any*/)
                                ],
                                "type": "DecisionPredicateQuestion",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v4/*:: as any*/),
                                  (v32/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "DecisionChoiceOption",
                                    "kind": "LinkedField",
                                    "name": "choices",
                                    "plural": true,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "value",
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "DecisionChoiceQuestion",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v4/*:: as any*/),
                                  (v32/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "DecisionScaleLevel",
                                    "kind": "LinkedField",
                                    "name": "levels",
                                    "plural": true,
                                    "selections": [
                                      (v23/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "DecisionScaleQuestion",
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
                        "concreteType": "DecisionScoringPolicy",
                        "kind": "LinkedField",
                        "name": "scoringPolicy",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "questions",
                            "plural": true,
                            "selections": [
                              (v21/*:: as any*/),
                              (v4/*:: as any*/),
                              (v22/*:: as any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v29/*:: as any*/)
                                ],
                                "type": "DecisionPredicateScoring",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "DecisionChoiceScore",
                                    "kind": "LinkedField",
                                    "name": "scores",
                                    "plural": true,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "choice",
                                        "storageKey": null
                                      },
                                      (v24/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "DecisionChoiceScoring",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "includeLabel",
                                    "storageKey": null
                                  }
                                ],
                                "type": "DecisionScaleScoring",
                                "abstractKey": null
                              }
                            ],
                            "storageKey": null
                          }
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
                      (v17/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SandboxConfig",
                        "kind": "LinkedField",
                        "name": "sandboxConfig",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v4/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SandboxProvider",
                            "kind": "LinkedField",
                            "name": "provider",
                            "plural": false,
                            "selections": [
                              (v18/*:: as any*/),
                              (v3/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "CodeEvaluator",
                    "abstractKey": null
                  },
                  (v20/*:: as any*/)
                ],
                "storageKey": null
              },
              (v19/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "outputConfigs",
                "plural": true,
                "selections": [
                  (v21/*:: as any*/),
                  (v25/*:: as any*/),
                  (v28/*:: as any*/),
                  (v30/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v3/*:: as any*/)
                    ],
                    "type": "Node",
                    "abstractKey": "__isNode"
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
    "cacheID": "2ed447fd78e40215a06427df9385ac98",
    "id": null,
    "metadata": {},
    "name": "EditDecisionDatasetEvaluatorSlideover_updateBindingMutation",
    "operationKind": "mutation",
    "text": "mutation EditDecisionDatasetEvaluatorSlideover_updateBindingMutation(\n  $input: UpdateDatasetDecisionEvaluatorInput!\n) {\n  updateDatasetDecisionEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      description\n      ...DatasetEvaluatorsTable_row\n      ...PlaygroundDatasetSection_evaluator\n      ...DecisionDatasetEvaluatorDetails_datasetEvaluator\n    }\n  }\n}\n\nfragment DatasetEvaluatorsTable_row on DatasetEvaluator {\n  id\n  name\n  description\n  updatedAt\n  user {\n    username\n    profilePictureUrl\n    id\n  }\n  evaluator {\n    __typename\n    id\n    name\n    kind\n    createdAt\n    updatedAt\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        id\n      }\n    }\n    ... on DecisionEvaluator {\n      decisionVersion {\n        id\n        decisionId\n        decision {\n          name\n          id\n        }\n        sequenceNumber\n        modelName\n        modelProvider\n      }\n    }\n    ... on CodeEvaluator {\n      language\n      sandboxConfig {\n        id\n        name\n        provider {\n          backendType\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment DecisionDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {\n  id\n  name\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  evaluator {\n    __typename\n    ... on DecisionEvaluator {\n      scoringPolicy {\n        questions {\n          __typename\n          name\n          optimizationDirection\n          ... on DecisionPredicateScoring {\n            threshold\n          }\n          ... on DecisionChoiceScoring {\n            scores {\n              choice\n              score\n            }\n          }\n          ... on DecisionScaleScoring {\n            includeLabel\n          }\n        }\n      }\n      decisionVersion {\n        id\n        decisionId\n        decision {\n          name\n          id\n        }\n        sequenceNumber\n        modelName\n        modelProvider\n        inputs {\n          name\n          description\n        }\n        questions {\n          __typename\n          ... on DecisionPredicateQuestion {\n            name\n            instructions\n          }\n          ... on DecisionChoiceQuestion {\n            name\n            instructions\n            choices {\n              value\n            }\n          }\n          ... on DecisionScaleQuestion {\n            name\n            instructions\n            levels {\n              label\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment PlaygroundDatasetSection_evaluator on DatasetEvaluator {\n  id\n  name\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  evaluator {\n    __typename\n    id\n    kind\n    isBuiltin\n  }\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on FreeformAnnotationConfig {\n      name\n      optimizationDirection\n      threshold\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "024e9c9c876222948d7ec9d583e29028";

export default node;
