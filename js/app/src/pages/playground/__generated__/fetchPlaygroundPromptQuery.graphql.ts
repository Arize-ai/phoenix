/**
 * @generated SignedSource<<dc5d0a1aad502fc62865286cda797418>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type PromptTemplateType = "CHAT" | "STRING";
export type PromptToolChoiceType = "NONE" | "ONE_OR_MORE" | "SPECIFIC_FUNCTION" | "ZERO_OR_MORE";
export type fetchPlaygroundPromptQuery$variables = {
  promptId: string;
  promptVersionId?: string | null;
  tagName?: string | null;
};
export type fetchPlaygroundPromptQuery$data = {
  readonly prompt: {
    readonly createdAt?: string;
    readonly description?: string | null;
    readonly id?: string;
    readonly name?: string;
    readonly version?: {
      readonly description: string | null;
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
      readonly tags: ReadonlyArray<{
        readonly name: string;
        readonly promptVersionId: string;
      }>;
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
      readonly " $fragmentSpreads": FragmentRefs<"fetchPlaygroundPrompt_promptVersionToInstance_promptVersion">;
    };
  };
};
export type fetchPlaygroundPromptQuery = {
  response: fetchPlaygroundPromptQuery$data;
  variables: fetchPlaygroundPromptQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptVersionId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "tagName"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "promptId"
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
  "name": "createdAt",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = [
  {
    "kind": "Variable",
    "name": "tagName",
    "variableName": "tagName"
  },
  {
    "kind": "Variable",
    "name": "versionId",
    "variableName": "promptVersionId"
  }
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
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
  "name": "temperature",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frequencyPenalty",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "presencePenalty",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "topP",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "extraBody",
  "storageKey": null
},
v15 = {
  "kind": "InlineFragment",
  "selections": [
    (v10/*:: as any*/),
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
    (v11/*:: as any*/),
    (v12/*:: as any*/),
    (v13/*:: as any*/),
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
    (v14/*:: as any*/)
  ],
  "type": "PromptOpenAIInvocationParameters",
  "abstractKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v17 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "anthropicMaxTokens",
      "args": null,
      "kind": "ScalarField",
      "name": "maxTokens",
      "storageKey": null
    },
    (v10/*:: as any*/),
    (v13/*:: as any*/),
    (v16/*:: as any*/),
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
    (v14/*:: as any*/)
  ],
  "type": "PromptAnthropicInvocationParameters",
  "abstractKey": null
},
v18 = {
  "kind": "InlineFragment",
  "selections": [
    (v10/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "maxOutputTokens",
      "storageKey": null
    },
    (v16/*:: as any*/),
    (v12/*:: as any*/),
    (v11/*:: as any*/),
    (v13/*:: as any*/),
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
v19 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "awsMaxTokens",
      "args": null,
      "kind": "ScalarField",
      "name": "maxTokens",
      "storageKey": null
    },
    (v10/*:: as any*/),
    (v13/*:: as any*/),
    (v16/*:: as any*/)
  ],
  "type": "PromptAwsInvocationParameters",
  "abstractKey": null
},
v20 = {
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
        (v15/*:: as any*/),
        (v17/*:: as any*/),
        (v18/*:: as any*/),
        (v19/*:: as any*/)
      ],
      "args": null,
      "argumentDefinitions": ([]/*:: as any*/)
    }
  ],
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "concreteType": "GenerativeModelCustomProvider",
  "kind": "LinkedField",
  "name": "customProvider",
  "plural": false,
  "selections": [
    (v2/*:: as any*/),
    (v3/*:: as any*/)
  ],
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "strict",
  "storageKey": null
},
v23 = {
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
        (v3/*:: as any*/),
        (v5/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "schema",
          "storageKey": null
        },
        (v22/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v25 = {
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
                    (v24/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "ToolCallFunction",
                      "kind": "LinkedField",
                      "name": "toolCall",
                      "plural": false,
                      "selections": [
                        (v3/*:: as any*/),
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
                    (v24/*:: as any*/),
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
v26 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "template",
  "plural": false,
  "selections": [
    (v9/*:: as any*/),
    (v25/*:: as any*/),
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
v27 = {
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
                (v3/*:: as any*/),
                (v5/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "parameters",
                  "storageKey": null
                },
                (v22/*:: as any*/)
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
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateType",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateFormat",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "promptVersionId",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "fetchPlaygroundPromptQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              {
                "alias": null,
                "args": (v6/*:: as any*/),
                "concreteType": "PromptVersion",
                "kind": "LinkedField",
                "name": "version",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineDataFragmentSpread",
                    "name": "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion",
                    "selections": [
                      (v2/*:: as any*/),
                      (v7/*:: as any*/),
                      (v8/*:: as any*/),
                      (v20/*:: as any*/),
                      (v21/*:: as any*/),
                      (v23/*:: as any*/),
                      (v26/*:: as any*/),
                      (v27/*:: as any*/)
                    ],
                    "args": null,
                    "argumentDefinitions": []
                  },
                  (v2/*:: as any*/),
                  (v5/*:: as any*/),
                  (v7/*:: as any*/),
                  (v8/*:: as any*/),
                  (v20/*:: as any*/),
                  (v28/*:: as any*/),
                  (v29/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersionTag",
                    "kind": "LinkedField",
                    "name": "tags",
                    "plural": true,
                    "selections": [
                      (v3/*:: as any*/),
                      (v30/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v23/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "template",
                    "plural": false,
                    "selections": [
                      (v9/*:: as any*/),
                      (v25/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v27/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Prompt",
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
    "name": "fetchPlaygroundPromptQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v9/*:: as any*/),
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              {
                "alias": null,
                "args": (v6/*:: as any*/),
                "concreteType": "PromptVersion",
                "kind": "LinkedField",
                "name": "version",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  (v7/*:: as any*/),
                  (v8/*:: as any*/),
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
                      (v15/*:: as any*/),
                      (v17/*:: as any*/),
                      (v18/*:: as any*/),
                      (v19/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v21/*:: as any*/),
                  (v23/*:: as any*/),
                  (v26/*:: as any*/),
                  (v27/*:: as any*/),
                  (v5/*:: as any*/),
                  (v28/*:: as any*/),
                  (v29/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersionTag",
                    "kind": "LinkedField",
                    "name": "tags",
                    "plural": true,
                    "selections": [
                      (v3/*:: as any*/),
                      (v30/*:: as any*/),
                      (v2/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Prompt",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "bbea36811c2f927c000c1aa6d169850e",
    "id": null,
    "metadata": {},
    "name": "fetchPlaygroundPromptQuery",
    "operationKind": "query",
    "text": "query fetchPlaygroundPromptQuery(\n  $promptId: ID!\n  $promptVersionId: ID\n  $tagName: Identifier\n) {\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      id\n      name\n      createdAt\n      description\n      version(versionId: $promptVersionId, tagName: $tagName) {\n        ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n        id\n        description\n        modelName\n        modelProvider\n        invocationParameters {\n          __typename\n          ...PromptInvocationParametersReadableFragment\n        }\n        templateType\n        templateFormat\n        tags {\n          name\n          promptVersionId\n          id\n        }\n        responseFormat {\n          jsonSchema {\n            name\n            description\n            schema\n            strict\n          }\n        }\n        template {\n          __typename\n          ... on PromptChatTemplate {\n            messages {\n              role\n              content {\n                __typename\n                ... on TextContentPart {\n                  text {\n                    text\n                  }\n                }\n                ... on ToolCallContentPart {\n                  toolCall {\n                    toolCallId\n                    toolCall {\n                      name\n                      arguments\n                    }\n                  }\n                }\n                ... on ToolResultContentPart {\n                  toolResult {\n                    toolCallId\n                    result\n                  }\n                }\n              }\n            }\n          }\n        }\n        tools {\n          tools {\n            __typename\n            ... on PromptToolFunction {\n              function {\n                name\n                description\n                parameters\n                strict\n              }\n            }\n            ... on PromptToolRaw {\n              raw\n            }\n          }\n          toolChoice {\n            type\n            functionName\n          }\n          disableParallelToolCalls\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment PromptInvocationParametersReadableFragment on PromptInvocationParameters {\n  __isPromptInvocationParameters: __typename\n  __typename\n  ... on PromptOpenAIInvocationParameters {\n    temperature\n    openaiMaxTokens: maxTokens\n    maxCompletionTokens\n    frequencyPenalty\n    presencePenalty\n    topP\n    seed\n    stop\n    reasoningEffort\n    extraBody\n  }\n  ... on PromptAnthropicInvocationParameters {\n    anthropicMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n    outputConfig {\n      effort\n    }\n    thinking {\n      __typename\n      ... on PromptAnthropicThinkingDisabled {\n        disabled\n      }\n      ... on PromptAnthropicThinkingEnabled {\n        budgetTokens\n        enabledDisplay: display\n      }\n      ... on PromptAnthropicThinkingAdaptive {\n        adaptiveDisplay: display\n      }\n    }\n    extraBody\n  }\n  ... on PromptGoogleInvocationParameters {\n    temperature\n    maxOutputTokens\n    stopSequences\n    presencePenalty\n    frequencyPenalty\n    topP\n    topK\n    thinkingConfig {\n      thinkingBudget\n      thinkingLevel\n      includeThoughts\n    }\n  }\n  ... on PromptAwsInvocationParameters {\n    awsMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n  }\n}\n\nfragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion {\n  id\n  modelName\n  modelProvider\n  invocationParameters {\n    __typename\n    ...PromptInvocationParametersReadableFragment\n  }\n  customProvider {\n    id\n    name\n  }\n  responseFormat {\n    jsonSchema {\n      name\n      description\n      schema\n      strict\n    }\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  tools {\n    tools {\n      __typename\n      ... on PromptToolFunction {\n        function {\n          name\n          description\n          parameters\n          strict\n        }\n      }\n      ... on PromptToolRaw {\n        raw\n      }\n    }\n    toolChoice {\n      type\n      functionName\n    }\n    disableParallelToolCalls\n  }\n}\n"
  }
};
})();

(node as any).hash = "48ba4c4ac0106a6cf276227509c4ecf3";

export default node;
