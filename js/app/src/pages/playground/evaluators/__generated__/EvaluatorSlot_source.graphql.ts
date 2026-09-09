/**
 * @generated SignedSource<<d938fcc1fda16909a12d8b3098a7ec23>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type Language = "PYTHON" | "TYPESCRIPT";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type EvaluatorSlot_source$data = {
  readonly description: string | null;
  readonly id: string;
  readonly inputMapping?: {
    readonly literalMapping: any;
    readonly pathMapping: any;
  };
  readonly isBuiltin: boolean;
  readonly kind: EvaluatorKind;
  readonly language?: Language;
  readonly name: string;
  readonly outputConfigs: ReadonlyArray<{
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
    readonly lowerBound: number | null;
    readonly name: string;
    readonly optimizationDirection: OptimizationDirection;
    readonly threshold: number | null;
    readonly upperBound: number | null;
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
    readonly templateFormat: PromptTemplateFormat;
    readonly " $fragmentSpreads": FragmentRefs<"fetchPlaygroundPrompt_promptVersionToInstance_promptVersion">;
  };
  readonly promptVersionTag?: {
    readonly name: string;
  } | null;
  readonly sandboxConfig?: {
    readonly id: string;
  } | null;
  readonly sourceCode?: string;
  readonly " $fragmentType": "EvaluatorSlot_source";
};
export type EvaluatorSlot_source$key = {
  readonly " $data"?: EvaluatorSlot_source$data;
  readonly " $fragmentSpreads": FragmentRefs<"EvaluatorSlot_source">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v7 = [
  (v0/*:: as any*/),
  (v1/*:: as any*/)
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "temperature",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frequencyPenalty",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "presencePenalty",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "topP",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "extraBody",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "strict",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "EvaluatorSlot_source",
  "selections": [
    (v0/*:: as any*/),
    (v1/*:: as any*/),
    (v2/*:: as any*/),
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
      "name": "isBuiltin",
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
        (v3/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            (v1/*:: as any*/),
            (v4/*:: as any*/),
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
            (v1/*:: as any*/),
            (v4/*:: as any*/),
            (v5/*:: as any*/),
            (v6/*:: as any*/)
          ],
          "type": "ContinuousAnnotationConfig",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            (v1/*:: as any*/),
            (v4/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "threshold",
              "storageKey": null
            },
            (v5/*:: as any*/),
            (v6/*:: as any*/)
          ],
          "type": "FreeformAnnotationConfig",
          "abstractKey": null
        }
      ],
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
          "selections": (v7/*:: as any*/),
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
              "name": "templateFormat",
              "storageKey": null
            },
            {
              "kind": "InlineDataFragmentSpread",
              "name": "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion",
              "selections": [
                (v0/*:: as any*/),
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
                        (v3/*:: as any*/),
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            (v8/*:: as any*/),
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
                            (v9/*:: as any*/),
                            (v10/*:: as any*/),
                            (v11/*:: as any*/),
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
                            (v12/*:: as any*/)
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
                            (v8/*:: as any*/),
                            (v11/*:: as any*/),
                            (v13/*:: as any*/),
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
                                (v3/*:: as any*/),
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
                            (v12/*:: as any*/)
                          ],
                          "type": "PromptAnthropicInvocationParameters",
                          "abstractKey": null
                        },
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            (v8/*:: as any*/),
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "maxOutputTokens",
                              "storageKey": null
                            },
                            (v13/*:: as any*/),
                            (v10/*:: as any*/),
                            (v9/*:: as any*/),
                            (v11/*:: as any*/),
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
                            (v8/*:: as any*/),
                            (v11/*:: as any*/),
                            (v13/*:: as any*/)
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
                  "concreteType": "GenerativeModelCustomProvider",
                  "kind": "LinkedField",
                  "name": "customProvider",
                  "plural": false,
                  "selections": (v7/*:: as any*/),
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "PromptResponseFormatJSONSchema",
                  "kind": "LinkedField",
                  "name": "responseFormat",
                  "plural": false,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "PromptResponseFormatJSONSchemaDefinition",
                      "kind": "LinkedField",
                      "name": "jsonSchema",
                      "plural": false,
                      "selections": [
                        (v1/*:: as any*/),
                        (v2/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "schema",
                          "storageKey": null
                        },
                        (v14/*:: as any*/)
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
                  "name": "template",
                  "plural": false,
                  "selections": [
                    (v3/*:: as any*/),
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "PromptMessage",
                          "kind": "LinkedField",
                          "name": "messages",
                          "plural": true,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "role",
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": null,
                              "kind": "LinkedField",
                              "name": "content",
                              "plural": true,
                              "selections": [
                                (v3/*:: as any*/),
                                {
                                  "kind": "InlineFragment",
                                  "selections": [
                                    {
                                      "alias": null,
                                      "args": null,
                                      "concreteType": "TextContentValue",
                                      "kind": "LinkedField",
                                      "name": "text",
                                      "plural": false,
                                      "selections": [
                                        {
                                          "alias": null,
                                          "args": null,
                                          "kind": "ScalarField",
                                          "name": "text",
                                          "storageKey": null
                                        }
                                      ],
                                      "storageKey": null
                                    }
                                  ],
                                  "type": "TextContentPart",
                                  "abstractKey": null
                                },
                                {
                                  "kind": "InlineFragment",
                                  "selections": [
                                    {
                                      "alias": null,
                                      "args": null,
                                      "concreteType": "ToolCallContentValue",
                                      "kind": "LinkedField",
                                      "name": "toolCall",
                                      "plural": false,
                                      "selections": [
                                        (v15/*:: as any*/),
                                        {
                                          "alias": null,
                                          "args": null,
                                          "concreteType": "ToolCallFunction",
                                          "kind": "LinkedField",
                                          "name": "toolCall",
                                          "plural": false,
                                          "selections": [
                                            (v1/*:: as any*/),
                                            {
                                              "alias": null,
                                              "args": null,
                                              "kind": "ScalarField",
                                              "name": "arguments",
                                              "storageKey": null
                                            }
                                          ],
                                          "storageKey": null
                                        }
                                      ],
                                      "storageKey": null
                                    }
                                  ],
                                  "type": "ToolCallContentPart",
                                  "abstractKey": null
                                },
                                {
                                  "kind": "InlineFragment",
                                  "selections": [
                                    {
                                      "alias": null,
                                      "args": null,
                                      "concreteType": "ToolResultContentValue",
                                      "kind": "LinkedField",
                                      "name": "toolResult",
                                      "plural": false,
                                      "selections": [
                                        (v15/*:: as any*/),
                                        {
                                          "alias": null,
                                          "args": null,
                                          "kind": "ScalarField",
                                          "name": "result",
                                          "storageKey": null
                                        }
                                      ],
                                      "storageKey": null
                                    }
                                  ],
                                  "type": "ToolResultContentPart",
                                  "abstractKey": null
                                }
                              ],
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        }
                      ],
                      "type": "PromptChatTemplate",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "template",
                          "storageKey": null
                        }
                      ],
                      "type": "PromptStringTemplate",
                      "abstractKey": null
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
                        (v3/*:: as any*/),
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
                                (v1/*:: as any*/),
                                (v2/*:: as any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "parameters",
                                  "storageKey": null
                                },
                                (v14/*:: as any*/)
                              ],
                              "storageKey": null
                            }
                          ],
                          "type": "PromptToolFunction",
                          "abstractKey": null
                        },
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "raw",
                              "storageKey": null
                            }
                          ],
                          "type": "PromptToolRaw",
                          "abstractKey": null
                        }
                      ],
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "PromptToolChoice",
                      "kind": "LinkedField",
                      "name": "toolChoice",
                      "plural": false,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "type",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "functionName",
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "disableParallelToolCalls",
                      "storageKey": null
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
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptVersionTag",
          "kind": "LinkedField",
          "name": "promptVersionTag",
          "plural": false,
          "selections": [
            (v1/*:: as any*/)
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
          "kind": "ScalarField",
          "name": "language",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "sourceCode",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfig",
          "kind": "LinkedField",
          "name": "sandboxConfig",
          "plural": false,
          "selections": [
            (v0/*:: as any*/)
          ],
          "storageKey": null
        },
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
        }
      ],
      "type": "CodeEvaluator",
      "abstractKey": null
    }
  ],
  "type": "Evaluator",
  "abstractKey": "__isEvaluator"
};
})();

(node as any).hash = "7d32ed693997a856d778843b7bd5aef9";

export default node;
