/**
 * @generated SignedSource<<bf86473a5f192e9a8aaff703bd0c421f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type LLMProjectEvaluatorDetails_projectEvaluator$data = {
  readonly evaluator: {
    readonly kind: EvaluatorKind;
    readonly outputConfigs?: ReadonlyArray<{
      readonly __typename: "CategoricalAnnotationConfig";
      readonly name: string;
      readonly optimizationDirection: OptimizationDirection;
      readonly values: ReadonlyArray<{
        readonly label: string;
        readonly score: number | null;
      }>;
    } | {
      readonly __typename: "ContinuousAnnotationConfig";
      readonly lowerBound: number | null;
      readonly name: string;
      readonly optimizationDirection: OptimizationDirection;
      readonly upperBound: number | null;
    } | {
      readonly __typename: "FreeformAnnotationConfig";
      readonly name: string;
      readonly optimizationDirection: OptimizationDirection;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    }>;
    readonly prompt?: {
      readonly id: string;
      readonly name: string;
    };
    readonly promptVersion?: {
      readonly invocationParameters: {
        readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParametersReadableFragment">;
      };
      readonly modelName: string;
      readonly modelProvider: ModelProvider;
      readonly tools: {
        readonly tools: ReadonlyArray<{
          readonly __typename: "PromptToolFunction";
          readonly function: {
            readonly parameters: any;
          };
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        }>;
      } | null;
      readonly " $fragmentSpreads": FragmentRefs<"PromptChatMessagesCard__main">;
    };
    readonly promptVersionTag?: {
      readonly name: string;
    } | null;
  };
  readonly inputMapping: {
    readonly literalMapping: any;
    readonly pathMapping: any;
  };
  readonly " $fragmentType": "LLMProjectEvaluatorDetails_projectEvaluator";
};
export type LLMProjectEvaluatorDetails_projectEvaluator$key = {
  readonly " $data"?: LLMProjectEvaluatorDetails_projectEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"LLMProjectEvaluatorDetails_projectEvaluator">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "temperature",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frequencyPenalty",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "presencePenalty",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "topP",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "extraBody",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "LLMProjectEvaluatorDetails_projectEvaluator",
  "selections": [
    {
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
          "name": "kind",
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
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "id",
                  "storageKey": null
                },
                (v0/*:: as any*/)
              ],
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
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "modelName",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "modelProvider",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "invocationParameters",
                  "plural": false,
                  "selections": [
                    {
                      "kind": "InlineDataFragmentSpread",
                      "name": "PromptInvocationParametersReadableFragment",
                      "selections": [
                        (v1/*:: as any*/),
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            (v2/*:: as any*/),
                            {
                              "alias": "openaiMaxTokens",
                              "args": null,
                              "kind": "ScalarField",
                              "name": "maxTokens",
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "maxCompletionTokens",
                              "storageKey": null
                            },
                            (v3/*:: as any*/),
                            (v4/*:: as any*/),
                            (v5/*:: as any*/),
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "seed",
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "stop",
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "reasoningEffort",
                              "storageKey": null
                            },
                            (v6/*:: as any*/)
                          ],
                          "type": "PromptOpenAIInvocationParameters",
                          "abstractKey": null
                        },
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            {
                              "alias": "anthropicMaxTokens",
                              "args": null,
                              "kind": "ScalarField",
                              "name": "maxTokens",
                              "storageKey": null
                            },
                            (v2/*:: as any*/),
                            (v5/*:: as any*/),
                            (v7/*:: as any*/),
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "PromptAnthropicOutputConfig",
                              "kind": "LinkedField",
                              "name": "outputConfig",
                              "plural": false,
                              "selections": [
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "effort",
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
                              "name": "thinking",
                              "plural": false,
                              "selections": [
                                (v1/*:: as any*/),
                                {
                                  "kind": "InlineFragment",
                                  "selections": [
                                    {
                                      "alias": null,
                                      "args": null,
                                      "kind": "ScalarField",
                                      "name": "disabled",
                                      "storageKey": null
                                    }
                                  ],
                                  "type": "PromptAnthropicThinkingDisabled",
                                  "abstractKey": null
                                },
                                {
                                  "kind": "InlineFragment",
                                  "selections": [
                                    {
                                      "alias": null,
                                      "args": null,
                                      "kind": "ScalarField",
                                      "name": "budgetTokens",
                                      "storageKey": null
                                    },
                                    {
                                      "alias": "enabledDisplay",
                                      "args": null,
                                      "kind": "ScalarField",
                                      "name": "display",
                                      "storageKey": null
                                    }
                                  ],
                                  "type": "PromptAnthropicThinkingEnabled",
                                  "abstractKey": null
                                },
                                {
                                  "kind": "InlineFragment",
                                  "selections": [
                                    {
                                      "alias": "adaptiveDisplay",
                                      "args": null,
                                      "kind": "ScalarField",
                                      "name": "display",
                                      "storageKey": null
                                    }
                                  ],
                                  "type": "PromptAnthropicThinkingAdaptive",
                                  "abstractKey": null
                                }
                              ],
                              "storageKey": null
                            },
                            (v6/*:: as any*/)
                          ],
                          "type": "PromptAnthropicInvocationParameters",
                          "abstractKey": null
                        },
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            (v2/*:: as any*/),
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "maxOutputTokens",
                              "storageKey": null
                            },
                            (v7/*:: as any*/),
                            (v4/*:: as any*/),
                            (v3/*:: as any*/),
                            (v5/*:: as any*/),
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "topK",
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "PromptGoogleThinkingConfig",
                              "kind": "LinkedField",
                              "name": "thinkingConfig",
                              "plural": false,
                              "selections": [
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "thinkingBudget",
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "thinkingLevel",
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "includeThoughts",
                                  "storageKey": null
                                }
                              ],
                              "storageKey": null
                            }
                          ],
                          "type": "PromptGoogleInvocationParameters",
                          "abstractKey": null
                        },
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            {
                              "alias": "awsMaxTokens",
                              "args": null,
                              "kind": "ScalarField",
                              "name": "maxTokens",
                              "storageKey": null
                            },
                            (v2/*:: as any*/),
                            (v5/*:: as any*/),
                            (v7/*:: as any*/)
                          ],
                          "type": "PromptAwsInvocationParameters",
                          "abstractKey": null
                        }
                      ],
                      "args": null,
                      "argumentDefinitions": []
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "PromptTools",
                  "kind": "LinkedField",
                  "name": "tools",
                  "plural": false,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": null,
                      "kind": "LinkedField",
                      "name": "tools",
                      "plural": true,
                      "selections": [
                        (v1/*:: as any*/),
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "PromptToolFunctionDefinition",
                              "kind": "LinkedField",
                              "name": "function",
                              "plural": false,
                              "selections": [
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "parameters",
                                  "storageKey": null
                                }
                              ],
                              "storageKey": null
                            }
                          ],
                          "type": "PromptToolFunction",
                          "abstractKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "PromptChatMessagesCard__main"
                }
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
                (v0/*:: as any*/)
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
                (v1/*:: as any*/),
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v0/*:: as any*/),
                    (v8/*:: as any*/),
                    {
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
                    }
                  ],
                  "type": "CategoricalAnnotationConfig",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v0/*:: as any*/),
                    (v8/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "lowerBound",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "upperBound",
                      "storageKey": null
                    }
                  ],
                  "type": "ContinuousAnnotationConfig",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v0/*:: as any*/),
                    (v8/*:: as any*/)
                  ],
                  "type": "FreeformAnnotationConfig",
                  "abstractKey": null
                }
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
  "type": "ProjectEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "6fdf5926d2b416baccc4a12f21117549";

export default node;
