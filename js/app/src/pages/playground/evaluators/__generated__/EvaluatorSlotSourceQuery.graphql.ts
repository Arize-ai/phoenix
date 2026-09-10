/**
 * @generated SignedSource<<fa139ea170bac7bd841d18068cf6a4b0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type Language = "PYTHON" | "TYPESCRIPT";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type EvaluatorSlotSourceQuery$variables = {
  hasSource: boolean;
  id: string;
};
export type EvaluatorSlotSourceQuery$data = {
  readonly node?: {
    readonly description?: string | null;
    readonly evaluator?: {
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
    };
    readonly id?: string;
    readonly inputMapping?: {
      readonly literalMapping: any;
      readonly pathMapping: any;
    };
    readonly isBuiltin?: boolean;
    readonly kind?: EvaluatorKind;
    readonly language?: Language;
    readonly name?: string;
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
  };
};
export type EvaluatorSlotSourceQuery = {
  response: EvaluatorSlotSourceQuery$data;
  variables: EvaluatorSlotSourceQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasSource"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
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
  "name": "kind",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isBuiltin",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v10 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v9/*:: as any*/),
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
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v13 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v9/*:: as any*/),
    (v11/*:: as any*/),
    (v12/*:: as any*/)
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v14 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v9/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "threshold",
      "storageKey": null
    },
    (v11/*:: as any*/),
    (v12/*:: as any*/)
  ],
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v8/*:: as any*/),
    (v10/*:: as any*/),
    (v13/*:: as any*/),
    (v14/*:: as any*/)
  ],
  "storageKey": null
},
v16 = [
  (v3/*:: as any*/),
  (v4/*:: as any*/)
],
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "Prompt",
  "kind": "LinkedField",
  "name": "prompt",
  "plural": false,
  "selections": (v16/*:: as any*/),
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateFormat",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "temperature",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frequencyPenalty",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "presencePenalty",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "topP",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "extraBody",
  "storageKey": null
},
v26 = {
  "kind": "InlineFragment",
  "selections": [
    (v21/*:: as any*/),
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
    (v22/*:: as any*/),
    (v23/*:: as any*/),
    (v24/*:: as any*/),
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
    (v25/*:: as any*/)
  ],
  "type": "PromptOpenAIInvocationParameters",
  "abstractKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v28 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "anthropicMaxTokens",
      "args": null,
      "kind": "ScalarField",
      "name": "maxTokens",
      "storageKey": null
    },
    (v21/*:: as any*/),
    (v24/*:: as any*/),
    (v27/*:: as any*/),
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
        (v8/*:: as any*/),
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
    (v25/*:: as any*/)
  ],
  "type": "PromptAnthropicInvocationParameters",
  "abstractKey": null
},
v29 = {
  "kind": "InlineFragment",
  "selections": [
    (v21/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "maxOutputTokens",
      "storageKey": null
    },
    (v27/*:: as any*/),
    (v23/*:: as any*/),
    (v22/*:: as any*/),
    (v24/*:: as any*/),
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
v30 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "awsMaxTokens",
      "args": null,
      "kind": "ScalarField",
      "name": "maxTokens",
      "storageKey": null
    },
    (v21/*:: as any*/),
    (v24/*:: as any*/),
    (v27/*:: as any*/)
  ],
  "type": "PromptAwsInvocationParameters",
  "abstractKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "concreteType": "GenerativeModelCustomProvider",
  "kind": "LinkedField",
  "name": "customProvider",
  "plural": false,
  "selections": (v16/*:: as any*/),
  "storageKey": null
},
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "strict",
  "storageKey": null
},
v33 = {
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
        (v4/*:: as any*/),
        (v5/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "schema",
          "storageKey": null
        },
        (v32/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v35 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "template",
  "plural": false,
  "selections": [
    (v8/*:: as any*/),
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
                (v8/*:: as any*/),
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
                        (v34/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "ToolCallFunction",
                          "kind": "LinkedField",
                          "name": "toolCall",
                          "plural": false,
                          "selections": [
                            (v4/*:: as any*/),
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
                        (v34/*:: as any*/),
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
v36 = {
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
        (v8/*:: as any*/),
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
                (v4/*:: as any*/),
                (v5/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "parameters",
                  "storageKey": null
                },
                (v32/*:: as any*/)
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
},
v37 = [
  (v3/*:: as any*/)
],
v38 = {
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
v39 = {
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
      "selections": (v37/*:: as any*/),
      "storageKey": null
    },
    (v38/*:: as any*/)
  ],
  "type": "CodeEvaluator",
  "abstractKey": null
},
v40 = [
  (v3/*:: as any*/),
  (v4/*:: as any*/),
  (v5/*:: as any*/),
  (v6/*:: as any*/),
  (v7/*:: as any*/),
  (v15/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v17/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "PromptVersion",
        "kind": "LinkedField",
        "name": "promptVersion",
        "plural": false,
        "selections": [
          (v18/*:: as any*/),
          {
            "kind": "InlineDataFragmentSpread",
            "name": "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion",
            "selections": [
              (v3/*:: as any*/),
              (v19/*:: as any*/),
              (v20/*:: as any*/),
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
                      (v8/*:: as any*/),
                      (v26/*:: as any*/),
                      (v28/*:: as any*/),
                      (v29/*:: as any*/),
                      (v30/*:: as any*/)
                    ],
                    "args": null,
                    "argumentDefinitions": ([]/*:: as any*/)
                  }
                ],
                "storageKey": null
              },
              (v31/*:: as any*/),
              (v33/*:: as any*/),
              (v35/*:: as any*/),
              (v36/*:: as any*/)
            ],
            "args": null,
            "argumentDefinitions": ([]/*:: as any*/)
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
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "LLMEvaluator",
    "abstractKey": null
  },
  (v39/*:: as any*/)
],
v41 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v8/*:: as any*/),
    {
      "kind": "TypeDiscriminator",
      "abstractKey": "__isBuiltInEvaluatorOutputConfig"
    },
    (v10/*:: as any*/),
    (v13/*:: as any*/),
    (v14/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": (v37/*:: as any*/),
      "type": "Node",
      "abstractKey": "__isNode"
    }
  ],
  "storageKey": null
},
v42 = {
  "kind": "InlineFragment",
  "selections": [
    (v17/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptVersion",
      "kind": "LinkedField",
      "name": "promptVersion",
      "plural": false,
      "selections": [
        (v18/*:: as any*/),
        (v3/*:: as any*/),
        (v19/*:: as any*/),
        (v20/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "invocationParameters",
          "plural": false,
          "selections": [
            (v8/*:: as any*/),
            {
              "kind": "TypeDiscriminator",
              "abstractKey": "__isPromptInvocationParameters"
            },
            (v26/*:: as any*/),
            (v28/*:: as any*/),
            (v29/*:: as any*/),
            (v30/*:: as any*/)
          ],
          "storageKey": null
        },
        (v31/*:: as any*/),
        (v33/*:: as any*/),
        (v35/*:: as any*/),
        (v36/*:: as any*/)
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
        (v4/*:: as any*/),
        (v3/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "LLMEvaluator",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorSlotSourceQuery",
    "selections": [
      {
        "condition": "hasSource",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v2/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": (v40/*:: as any*/),
                "type": "Evaluator",
                "abstractKey": "__isEvaluator"
              },
              {
                "kind": "InlineFragment",
                "selections": [
                  (v4/*:: as any*/),
                  (v38/*:: as any*/),
                  (v15/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": (v40/*:: as any*/),
                    "storageKey": null
                  }
                ],
                "type": "DatasetEvaluator",
                "abstractKey": null
              }
            ],
            "storageKey": null
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "EvaluatorSlotSourceQuery",
    "selections": [
      {
        "condition": "hasSource",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": (v2/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v8/*:: as any*/),
              (v3/*:: as any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v7/*:: as any*/),
                  (v41/*:: as any*/),
                  (v42/*:: as any*/),
                  (v39/*:: as any*/)
                ],
                "type": "Evaluator",
                "abstractKey": "__isEvaluator"
              },
              {
                "kind": "InlineFragment",
                "selections": [
                  (v4/*:: as any*/),
                  (v38/*:: as any*/),
                  (v41/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v8/*:: as any*/),
                      {
                        "kind": "TypeDiscriminator",
                        "abstractKey": "__isEvaluator"
                      },
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      (v5/*:: as any*/),
                      (v6/*:: as any*/),
                      (v7/*:: as any*/),
                      (v41/*:: as any*/),
                      (v42/*:: as any*/),
                      (v39/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "type": "DatasetEvaluator",
                "abstractKey": null
              }
            ],
            "storageKey": null
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "13f09fdf943fd8457bcdd3d513015b95",
    "id": null,
    "metadata": {},
    "name": "EvaluatorSlotSourceQuery",
    "operationKind": "query",
    "text": "query EvaluatorSlotSourceQuery(\n  $id: ID!\n  $hasSource: Boolean!\n) {\n  node(id: $id) @include(if: $hasSource) {\n    __typename\n    ... on Evaluator {\n      __isEvaluator: __typename\n      id\n      name\n      description\n      kind\n      isBuiltin\n      outputConfigs {\n        __typename\n        __isBuiltInEvaluatorOutputConfig: __typename\n        ... on CategoricalAnnotationConfig {\n          name\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          name\n          optimizationDirection\n          lowerBound\n          upperBound\n        }\n        ... on FreeformAnnotationConfig {\n          name\n          optimizationDirection\n          threshold\n          lowerBound\n          upperBound\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n      ... on LLMEvaluator {\n        prompt {\n          id\n          name\n        }\n        promptVersion {\n          templateFormat\n          ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n          id\n        }\n        promptVersionTag {\n          name\n          id\n        }\n      }\n      ... on CodeEvaluator {\n        language\n        sourceCode\n        sandboxConfig {\n          id\n        }\n        inputMapping {\n          literalMapping\n          pathMapping\n        }\n      }\n    }\n    ... on DatasetEvaluator {\n      name\n      inputMapping {\n        literalMapping\n        pathMapping\n      }\n      outputConfigs {\n        __typename\n        __isBuiltInEvaluatorOutputConfig: __typename\n        ... on CategoricalAnnotationConfig {\n          name\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          name\n          optimizationDirection\n          lowerBound\n          upperBound\n        }\n        ... on FreeformAnnotationConfig {\n          name\n          optimizationDirection\n          threshold\n          lowerBound\n          upperBound\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n      evaluator {\n        __typename\n        __isEvaluator: __typename\n        id\n        name\n        description\n        kind\n        isBuiltin\n        outputConfigs {\n          __typename\n          __isBuiltInEvaluatorOutputConfig: __typename\n          ... on CategoricalAnnotationConfig {\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on ContinuousAnnotationConfig {\n            name\n            optimizationDirection\n            lowerBound\n            upperBound\n          }\n          ... on FreeformAnnotationConfig {\n            name\n            optimizationDirection\n            threshold\n            lowerBound\n            upperBound\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n        ... on LLMEvaluator {\n          prompt {\n            id\n            name\n          }\n          promptVersion {\n            templateFormat\n            ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n            id\n          }\n          promptVersionTag {\n            name\n            id\n          }\n        }\n        ... on CodeEvaluator {\n          language\n          sourceCode\n          sandboxConfig {\n            id\n          }\n          inputMapping {\n            literalMapping\n            pathMapping\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment PromptInvocationParametersReadableFragment on PromptInvocationParameters {\n  __isPromptInvocationParameters: __typename\n  __typename\n  ... on PromptOpenAIInvocationParameters {\n    temperature\n    openaiMaxTokens: maxTokens\n    maxCompletionTokens\n    frequencyPenalty\n    presencePenalty\n    topP\n    seed\n    stop\n    reasoningEffort\n    extraBody\n  }\n  ... on PromptAnthropicInvocationParameters {\n    anthropicMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n    outputConfig {\n      effort\n    }\n    thinking {\n      __typename\n      ... on PromptAnthropicThinkingDisabled {\n        disabled\n      }\n      ... on PromptAnthropicThinkingEnabled {\n        budgetTokens\n        enabledDisplay: display\n      }\n      ... on PromptAnthropicThinkingAdaptive {\n        adaptiveDisplay: display\n      }\n    }\n    extraBody\n  }\n  ... on PromptGoogleInvocationParameters {\n    temperature\n    maxOutputTokens\n    stopSequences\n    presencePenalty\n    frequencyPenalty\n    topP\n    topK\n    thinkingConfig {\n      thinkingBudget\n      thinkingLevel\n      includeThoughts\n    }\n  }\n  ... on PromptAwsInvocationParameters {\n    awsMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n  }\n}\n\nfragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion {\n  id\n  modelName\n  modelProvider\n  invocationParameters {\n    __typename\n    ...PromptInvocationParametersReadableFragment\n  }\n  customProvider {\n    id\n    name\n  }\n  responseFormat {\n    jsonSchema {\n      name\n      description\n      schema\n      strict\n    }\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  tools {\n    tools {\n      __typename\n      ... on PromptToolFunction {\n        function {\n          name\n          description\n          parameters\n          strict\n        }\n      }\n      ... on PromptToolRaw {\n        raw\n      }\n    }\n    toolChoice {\n      type\n      functionName\n    }\n    disableParallelToolCalls\n  }\n}\n"
  }
};
})();

(node as any).hash = "245a7784f1cf7042f9b66fb3524e14ba";

export default node;
