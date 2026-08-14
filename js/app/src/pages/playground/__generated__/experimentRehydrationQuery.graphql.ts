/**
 * @generated SignedSource<<e4a08d40172cbef4fa73b5a54cc4fa76>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type PromptTemplateType = "CHAT" | "STRING";
export type PromptToolChoiceType = "NONE" | "ONE_OR_MORE" | "SPECIFIC_FUNCTION" | "ZERO_OR_MORE";
export type experimentRehydrationQuery$variables = {
  experimentId: string;
};
export type experimentRehydrationQuery$data = {
  readonly node: {
    readonly dataset?: {
      readonly id: string;
    };
    readonly job?: {
      readonly datasetEvaluators: {
        readonly edges: ReadonlyArray<{
          readonly node: {
            readonly id: string;
          };
        }>;
      };
      readonly maxConcurrency: number;
      readonly taskConfig: {
        readonly connection: {
          readonly __typename: "AWSBedrockConnectionConfig";
          readonly endpointUrl: string | null;
          readonly regionName: string | null;
        } | {
          readonly __typename: "AnthropicConnectionConfig";
          readonly baseUrl: string | null;
        } | {
          readonly __typename: "AzureOpenAIConnectionConfig";
          readonly azureEndpoint: string;
          readonly openaiApiType: OpenAIApiType;
        } | {
          readonly __typename: "GoogleGenAIConnectionConfig";
          readonly baseUrl: string | null;
        } | {
          readonly __typename: "OpenAIConnectionConfig";
          readonly baseUrl: string | null;
          readonly openaiApiType: OpenAIApiType;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        } | null;
        readonly customProvider: {
          readonly id: string;
          readonly name: string;
        } | null;
        readonly playgroundConfig: {
          readonly appendedMessagesPath: string | null;
          readonly templateVariablesPath: string | null;
        } | null;
        readonly prompt: {
          readonly invocationParameters: {
            readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParametersReadableFragment">;
          };
          readonly modelName: string;
          readonly modelProvider: GenerativeProviderKey;
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
        };
        readonly streamModelOutput: boolean;
      } | null;
    } | null;
  };
};
export type experimentRehydrationQuery = {
  response: experimentRehydrationQuery$data;
  variables: experimentRehydrationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "experimentId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = [
  (v2/*:: as any*/)
],
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "Dataset",
  "kind": "LinkedField",
  "name": "dataset",
  "plural": false,
  "selections": (v3/*:: as any*/),
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxConcurrency",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetEvaluatorConnection",
  "kind": "LinkedField",
  "name": "datasetEvaluators",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetEvaluatorEdge",
      "kind": "LinkedField",
      "name": "edges",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DatasetEvaluator",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": (v3/*:: as any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateType",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateFormat",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "template",
  "plural": false,
  "selections": [
    (v9/*:: as any*/),
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
                (v9/*:: as any*/),
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
                        (v10/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "ToolCallFunction",
                          "kind": "LinkedField",
                          "name": "toolCall",
                          "plural": false,
                          "selections": [
                            (v11/*:: as any*/),
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
    }
  ],
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
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
        (v9/*:: as any*/),
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
                (v11/*:: as any*/),
                (v13/*:: as any*/),
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
},
v16 = {
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
        (v11/*:: as any*/),
        (v13/*:: as any*/),
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
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "temperature",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frequencyPenalty",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "presencePenalty",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "topP",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "extraBody",
  "storageKey": null
},
v22 = {
  "kind": "InlineFragment",
  "selections": [
    (v17/*:: as any*/),
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
    (v18/*:: as any*/),
    (v19/*:: as any*/),
    (v20/*:: as any*/),
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
    (v21/*:: as any*/)
  ],
  "type": "PromptOpenAIInvocationParameters",
  "abstractKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v24 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "anthropicMaxTokens",
      "args": null,
      "kind": "ScalarField",
      "name": "maxTokens",
      "storageKey": null
    },
    (v17/*:: as any*/),
    (v20/*:: as any*/),
    (v23/*:: as any*/),
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
        (v9/*:: as any*/),
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
    (v21/*:: as any*/)
  ],
  "type": "PromptAnthropicInvocationParameters",
  "abstractKey": null
},
v25 = {
  "kind": "InlineFragment",
  "selections": [
    (v17/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "maxOutputTokens",
      "storageKey": null
    },
    (v23/*:: as any*/),
    (v19/*:: as any*/),
    (v18/*:: as any*/),
    (v20/*:: as any*/),
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
v26 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "awsMaxTokens",
      "args": null,
      "kind": "ScalarField",
      "name": "maxTokens",
      "storageKey": null
    },
    (v17/*:: as any*/),
    (v20/*:: as any*/),
    (v23/*:: as any*/)
  ],
  "type": "PromptAwsInvocationParameters",
  "abstractKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "baseUrl",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "openaiApiType",
  "storageKey": null
},
v31 = [
  (v29/*:: as any*/)
],
v32 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "connection",
  "plural": false,
  "selections": [
    (v9/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        (v29/*:: as any*/),
        (v30/*:: as any*/)
      ],
      "type": "OpenAIConnectionConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "azureEndpoint",
          "storageKey": null
        },
        (v30/*:: as any*/)
      ],
      "type": "AzureOpenAIConnectionConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": (v31/*:: as any*/),
      "type": "AnthropicConnectionConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "regionName",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "endpointUrl",
          "storageKey": null
        }
      ],
      "type": "AWSBedrockConnectionConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": (v31/*:: as any*/),
      "type": "GoogleGenAIConnectionConfig",
      "abstractKey": null
    }
  ],
  "storageKey": null
},
v33 = {
  "alias": null,
  "args": null,
  "concreteType": "GenerativeModelCustomProvider",
  "kind": "LinkedField",
  "name": "customProvider",
  "plural": false,
  "selections": [
    (v2/*:: as any*/),
    (v11/*:: as any*/)
  ],
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "concreteType": "PlaygroundConfig",
  "kind": "LinkedField",
  "name": "playgroundConfig",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "templateVariablesPath",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "appendedMessagesPath",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v35 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "streamModelOutput",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "experimentRehydrationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentJob",
                "kind": "LinkedField",
                "name": "job",
                "plural": false,
                "selections": [
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptTaskConfig",
                    "kind": "LinkedField",
                    "name": "taskConfig",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptConfig",
                        "kind": "LinkedField",
                        "name": "prompt",
                        "plural": false,
                        "selections": [
                          (v7/*:: as any*/),
                          (v8/*:: as any*/),
                          (v12/*:: as any*/),
                          (v15/*:: as any*/),
                          (v16/*:: as any*/),
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
                                  (v9/*:: as any*/),
                                  (v22/*:: as any*/),
                                  (v24/*:: as any*/),
                                  (v25/*:: as any*/),
                                  (v26/*:: as any*/)
                                ],
                                "args": null,
                                "argumentDefinitions": []
                              }
                            ],
                            "storageKey": null
                          },
                          (v27/*:: as any*/),
                          (v28/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      (v32/*:: as any*/),
                      (v33/*:: as any*/),
                      (v34/*:: as any*/),
                      (v35/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Experiment",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "experimentRehydrationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v9/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentJob",
                "kind": "LinkedField",
                "name": "job",
                "plural": false,
                "selections": [
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptTaskConfig",
                    "kind": "LinkedField",
                    "name": "taskConfig",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptConfig",
                        "kind": "LinkedField",
                        "name": "prompt",
                        "plural": false,
                        "selections": [
                          (v7/*:: as any*/),
                          (v8/*:: as any*/),
                          (v12/*:: as any*/),
                          (v15/*:: as any*/),
                          (v16/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "invocationParameters",
                            "plural": false,
                            "selections": [
                              (v9/*:: as any*/),
                              {
                                "kind": "TypeDiscriminator",
                                "abstractKey": "__isPromptInvocationParameters"
                              },
                              (v22/*:: as any*/),
                              (v24/*:: as any*/),
                              (v25/*:: as any*/),
                              (v26/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v27/*:: as any*/),
                          (v28/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      (v32/*:: as any*/),
                      (v33/*:: as any*/),
                      (v34/*:: as any*/),
                      (v35/*:: as any*/),
                      (v2/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v2/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Experiment",
            "abstractKey": null
          },
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "cfc7be7fc4597ce57a4380a2e714f18a",
    "id": null,
    "metadata": {},
    "name": "experimentRehydrationQuery",
    "operationKind": "query",
    "text": "query experimentRehydrationQuery(\n  $experimentId: ID!\n) {\n  node(id: $experimentId) {\n    __typename\n    ... on Experiment {\n      dataset {\n        id\n      }\n      job {\n        maxConcurrency\n        datasetEvaluators {\n          edges {\n            node {\n              id\n            }\n          }\n        }\n        taskConfig {\n          prompt {\n            templateType\n            templateFormat\n            template {\n              __typename\n              ... on PromptChatTemplate {\n                messages {\n                  role\n                  content {\n                    __typename\n                    ... on TextContentPart {\n                      text {\n                        text\n                      }\n                    }\n                    ... on ToolCallContentPart {\n                      toolCall {\n                        toolCallId\n                        toolCall {\n                          name\n                          arguments\n                        }\n                      }\n                    }\n                    ... on ToolResultContentPart {\n                      toolResult {\n                        toolCallId\n                        result\n                      }\n                    }\n                  }\n                }\n              }\n            }\n            tools {\n              tools {\n                __typename\n                ... on PromptToolFunction {\n                  function {\n                    name\n                    description\n                    parameters\n                    strict\n                  }\n                }\n                ... on PromptToolRaw {\n                  raw\n                }\n              }\n              toolChoice {\n                type\n                functionName\n              }\n              disableParallelToolCalls\n            }\n            responseFormat {\n              jsonSchema {\n                name\n                description\n                schema\n                strict\n              }\n            }\n            invocationParameters {\n              __typename\n              ...PromptInvocationParametersReadableFragment\n            }\n            modelProvider\n            modelName\n          }\n          connection {\n            __typename\n            ... on OpenAIConnectionConfig {\n              baseUrl\n              openaiApiType\n            }\n            ... on AzureOpenAIConnectionConfig {\n              azureEndpoint\n              openaiApiType\n            }\n            ... on AnthropicConnectionConfig {\n              baseUrl\n            }\n            ... on AWSBedrockConnectionConfig {\n              regionName\n              endpointUrl\n            }\n            ... on GoogleGenAIConnectionConfig {\n              baseUrl\n            }\n          }\n          customProvider {\n            id\n            name\n          }\n          playgroundConfig {\n            templateVariablesPath\n            appendedMessagesPath\n          }\n          streamModelOutput\n          id\n        }\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment PromptInvocationParametersReadableFragment on PromptInvocationParameters {\n  __isPromptInvocationParameters: __typename\n  __typename\n  ... on PromptOpenAIInvocationParameters {\n    temperature\n    openaiMaxTokens: maxTokens\n    maxCompletionTokens\n    frequencyPenalty\n    presencePenalty\n    topP\n    seed\n    stop\n    reasoningEffort\n    extraBody\n  }\n  ... on PromptAnthropicInvocationParameters {\n    anthropicMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n    outputConfig {\n      effort\n    }\n    thinking {\n      __typename\n      ... on PromptAnthropicThinkingDisabled {\n        disabled\n      }\n      ... on PromptAnthropicThinkingEnabled {\n        budgetTokens\n        enabledDisplay: display\n      }\n      ... on PromptAnthropicThinkingAdaptive {\n        adaptiveDisplay: display\n      }\n    }\n    extraBody\n  }\n  ... on PromptGoogleInvocationParameters {\n    temperature\n    maxOutputTokens\n    stopSequences\n    presencePenalty\n    frequencyPenalty\n    topP\n    topK\n    thinkingConfig {\n      thinkingBudget\n      thinkingLevel\n      includeThoughts\n    }\n  }\n  ... on PromptAwsInvocationParameters {\n    awsMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n  }\n}\n"
  }
};
})();

(node as any).hash = "02e91c24f69014d6d00d56db1e490c5a";

export default node;
