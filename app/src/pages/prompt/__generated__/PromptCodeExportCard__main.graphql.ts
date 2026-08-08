/**
 * @generated SignedSource<<844519f3b410f9f76477551c9dfafd86>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type PromptTemplateType = "CHAT" | "STRING";
export type PromptToolChoiceType = "NONE" | "ONE_OR_MORE" | "SPECIFIC_FUNCTION" | "ZERO_OR_MORE";
import { FragmentRefs } from "relay-runtime";
export type PromptCodeExportCard__main$data = {
  readonly id: string;
  readonly invocationParameters: {
    readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParametersReadableFragment">;
  };
  readonly modelName: string;
  readonly modelProvider: ModelProvider;
  readonly responseFormat: {
    readonly jsonSchema: {
      readonly description: string | null;
      readonly name: string;
      readonly schema: any | null;
      readonly strict: boolean | null;
    };
  } | null;
  readonly template: {
    readonly __typename: "PromptChatTemplate";
    readonly messages: ReadonlyArray<{
      readonly content: ReadonlyArray<{
        readonly __typename: "TextContentPart";
        readonly text: {
          readonly text: string;
        };
      } | {
        readonly __typename: "ToolCallContentPart";
        readonly toolCall: {
          readonly toolCall: {
            readonly arguments: string;
            readonly name: string;
          };
          readonly toolCallId: string;
        };
      } | {
        readonly __typename: "ToolResultContentPart";
        readonly toolResult: {
          readonly result: any;
          readonly toolCallId: string;
        };
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      }>;
      readonly role: PromptMessageRole;
    }>;
  } | {
    readonly __typename: "PromptStringTemplate";
    readonly template: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly templateFormat: PromptTemplateFormat;
  readonly templateType: PromptTemplateType;
  readonly tools: {
    readonly disableParallelToolCalls: boolean | null;
    readonly toolChoice: {
      readonly functionName: string | null;
      readonly type: PromptToolChoiceType;
    } | null;
    readonly tools: ReadonlyArray<{
      readonly __typename: "PromptToolFunction";
      readonly function: {
        readonly description: string | null;
        readonly name: string;
        readonly parameters: any;
        readonly strict: boolean | null;
      };
    } | {
      readonly __typename: "PromptToolRaw";
      readonly raw: any;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    }>;
  } | null;
  readonly " $fragmentType": "PromptCodeExportCard__main";
};
export type PromptCodeExportCard__main$key = {
  readonly " $data"?: PromptCodeExportCard__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptCodeExportCard__main">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "temperature",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frequencyPenalty",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "presencePenalty",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "topP",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "extraBody",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
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
  "name": "strict",
  "storageKey": null
},
v10 = {
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
  "name": "PromptCodeExportCard__main",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
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
            (v0/*:: as any*/),
            {
              "kind": "InlineFragment",
              "selections": [
                (v1/*:: as any*/),
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
                (v2/*:: as any*/),
                (v3/*:: as any*/),
                (v4/*:: as any*/),
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
                (v5/*:: as any*/)
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
                (v1/*:: as any*/),
                (v4/*:: as any*/),
                (v6/*:: as any*/),
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
                    (v0/*:: as any*/),
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
                (v5/*:: as any*/)
              ],
              "type": "PromptAnthropicInvocationParameters",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                (v1/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "maxOutputTokens",
                  "storageKey": null
                },
                (v6/*:: as any*/),
                (v3/*:: as any*/),
                (v2/*:: as any*/),
                (v4/*:: as any*/),
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
                (v1/*:: as any*/),
                (v4/*:: as any*/),
                (v6/*:: as any*/)
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
            (v7/*:: as any*/),
            (v8/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "schema",
              "storageKey": null
            },
            (v9/*:: as any*/)
          ],
          "storageKey": null
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
            (v0/*:: as any*/),
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
                    (v7/*:: as any*/),
                    (v8/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "parameters",
                      "storageKey": null
                    },
                    (v9/*:: as any*/)
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
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "template",
      "plural": false,
      "selections": [
        (v0/*:: as any*/),
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
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v0/*:: as any*/),
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
                        (v0/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "ToolCallContentValue",
                          "kind": "LinkedField",
                          "name": "toolCall",
                          "plural": false,
                          "selections": [
                            (v10/*:: as any*/),
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "ToolCallFunction",
                              "kind": "LinkedField",
                              "name": "toolCall",
                              "plural": false,
                              "selections": [
                                (v7/*:: as any*/),
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
                        (v0/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "ToolResultContentValue",
                          "kind": "LinkedField",
                          "name": "toolResult",
                          "plural": false,
                          "selections": [
                            (v10/*:: as any*/),
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
      "kind": "ScalarField",
      "name": "templateFormat",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "templateType",
      "storageKey": null
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};
})();

(node as any).hash = "005666df96327a27e41f99f7db288d2c";

export default node;
