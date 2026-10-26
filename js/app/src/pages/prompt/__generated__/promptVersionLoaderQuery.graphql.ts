/**
 * @generated SignedSource<<650b7e0d316ff5f6b299033e2d5a19d7>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type promptVersionLoaderQuery$variables = {
  id: string;
};
export type promptVersionLoaderQuery$data = {
  readonly promptVersion: {
    readonly __typename: string;
    readonly description?: string | null;
    readonly id: string;
    readonly modelName?: string;
    readonly previousVersion?: {
      readonly " $fragmentSpreads": FragmentRefs<"PromptVersionDiffView__template">;
    } | null;
    readonly tags?: ReadonlyArray<{
      readonly name: string;
    }>;
    readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionDetailsPage__main" | "PromptChatMessagesCard__main" | "PromptCodeExportCard__main" | "PromptInvocationParameters__main" | "PromptModelConfigurationCard__main" | "PromptVersionDiffView__template" | "PromptVersionMetadataCard__main" | "PromptVersionTagsList_data">;
  };
};
export type promptVersionLoaderQuery = {
  response: promptVersionLoaderQuery$data;
  variables: promptVersionLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
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
  "name": "description",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
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
  "args": null,
  "kind": "FragmentSpread",
  "name": "PromptVersionDiffView__template"
},
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
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "template",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "template",
  "plural": false,
  "selections": [
    (v2/*:: as any*/),
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
                (v2/*:: as any*/),
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
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "arguments",
                              "storageKey": null
                            },
                            (v6/*:: as any*/)
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
        (v16/*:: as any*/)
      ],
      "type": "PromptStringTemplate",
      "abstractKey": null
    }
  ],
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
  "name": "metadata",
  "storageKey": null
},
v20 = [
  (v3/*:: as any*/),
  (v6/*:: as any*/)
],
v21 = {
  "alias": null,
  "args": null,
  "concreteType": "DecisionInputDefinition",
  "kind": "LinkedField",
  "name": "inputs",
  "plural": true,
  "selections": [
    (v6/*:: as any*/),
    (v4/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "jsonSchema",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "state",
  "plural": false,
  "selections": [
    (v2/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "object",
          "storageKey": null
        }
      ],
      "type": "DecisionObjectState",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v16/*:: as any*/),
        (v18/*:: as any*/)
      ],
      "type": "DecisionTextState",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "input",
          "storageKey": null
        }
      ],
      "type": "DecisionInputState",
      "abstractKey": null
    }
  ],
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "instructions",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "questions",
  "plural": true,
  "selections": [
    (v2/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        (v6/*:: as any*/),
        (v23/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "DecisionPredicateCriteria",
          "kind": "LinkedField",
          "name": "criteria",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "true",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "false",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "type": "DecisionPredicateQuestion",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v6/*:: as any*/),
        (v23/*:: as any*/),
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
            },
            (v4/*:: as any*/)
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
        (v6/*:: as any*/),
        (v23/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "DecisionScaleLevel",
          "kind": "LinkedField",
          "name": "levels",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "label",
              "storageKey": null
            },
            (v4/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "type": "DecisionScaleQuestion",
      "abstractKey": null
    }
  ],
  "storageKey": null
},
v25 = {
  "alias": "decisionModelProvider",
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "concreteType": "GenerativeModelCustomProvider",
  "kind": "LinkedField",
  "name": "customProvider",
  "plural": false,
  "selections": (v20/*:: as any*/),
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "promptVersionLoaderQuery",
    "selections": [
      {
        "alias": "promptVersion",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptInvocationParameters__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptChatMessagesCard__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptCodeExportCard__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptModelConfigurationCard__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptVersionMetadataCard__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptVersionTagsList_data"
              },
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersionTag",
                "kind": "LinkedField",
                "name": "tags",
                "plural": true,
                "selections": [
                  (v6/*:: as any*/)
                ],
                "storageKey": null
              },
              (v7/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersion",
                "kind": "LinkedField",
                "name": "previousVersion",
                "plural": false,
                "selections": [
                  (v7/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "PromptVersion",
            "abstractKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DecisionVersionDetailsPage__main"
              }
            ],
            "type": "DecisionVersion",
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
    "name": "promptVersionLoaderQuery",
    "selections": [
      {
        "alias": "promptVersion",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "invocationParameters",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  {
                    "kind": "TypeDiscriminator",
                    "abstractKey": "__isPromptInvocationParameters"
                  },
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
                          (v2/*:: as any*/),
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
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "tools",
                    "plural": true,
                    "selections": [
                      (v2/*:: as any*/),
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
                              (v6/*:: as any*/),
                              (v4/*:: as any*/),
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
                    "kind": "ScalarField",
                    "name": "disableParallelToolCalls",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": "provider",
                "args": null,
                "kind": "ScalarField",
                "name": "modelProvider",
                "storageKey": null
              },
              (v17/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "templateType",
                "storageKey": null
              },
              (v18/*:: as any*/),
              (v5/*:: as any*/),
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
                      (v6/*:: as any*/),
                      (v4/*:: as any*/),
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
                "alias": "model",
                "args": null,
                "kind": "ScalarField",
                "name": "modelName",
                "storageKey": null
              },
              (v19/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersionTag",
                "kind": "LinkedField",
                "name": "tags",
                "plural": true,
                "selections": (v20/*:: as any*/),
                "storageKey": null
              },
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersion",
                "kind": "LinkedField",
                "name": "previousVersion",
                "plural": false,
                "selections": [
                  (v17/*:: as any*/),
                  (v3/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "PromptVersion",
            "abstractKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              (v19/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Decision",
                "kind": "LinkedField",
                "name": "decision",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DecisionVersionTag",
                    "kind": "LinkedField",
                    "name": "versionTags",
                    "plural": true,
                    "selections": (v20/*:: as any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionVersionTag",
                "kind": "LinkedField",
                "name": "tags",
                "plural": true,
                "selections": (v20/*:: as any*/),
                "storageKey": null
              },
              (v21/*:: as any*/),
              (v22/*:: as any*/),
              (v24/*:: as any*/),
              (v5/*:: as any*/),
              (v25/*:: as any*/),
              (v26/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionVersion",
                "kind": "LinkedField",
                "name": "previousVersion",
                "plural": false,
                "selections": [
                  (v21/*:: as any*/),
                  (v22/*:: as any*/),
                  (v24/*:: as any*/),
                  (v5/*:: as any*/),
                  (v25/*:: as any*/),
                  (v26/*:: as any*/),
                  (v3/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "DecisionVersion",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "d94f1171d5962146d504ad6c1a4c7685",
    "id": null,
    "metadata": {},
    "name": "promptVersionLoaderQuery",
    "operationKind": "query",
    "text": "query promptVersionLoaderQuery(\n  $id: ID!\n) {\n  promptVersion: node(id: $id) {\n    __typename\n    id\n    ... on PromptVersion {\n      ...PromptInvocationParameters__main\n      ...PromptChatMessagesCard__main\n      ...PromptCodeExportCard__main\n      ...PromptModelConfigurationCard__main\n      ...PromptVersionMetadataCard__main\n      ...PromptVersionTagsList_data\n      description\n      modelName\n      tags {\n        name\n        id\n      }\n      ...PromptVersionDiffView__template\n      previousVersion {\n        ...PromptVersionDiffView__template\n        id\n      }\n    }\n    ... on DecisionVersion {\n      ...DecisionVersionDetailsPage__main\n    }\n  }\n}\n\nfragment DecisionCodeExportCard_version on DecisionVersion {\n  id\n  inputs {\n    name\n  }\n}\n\nfragment DecisionDefinitionCard_version on DecisionVersion {\n  inputs {\n    name\n    description\n    jsonSchema\n  }\n  state {\n    __typename\n    ... on DecisionObjectState {\n      object\n    }\n    ... on DecisionTextState {\n      template\n      templateFormat\n    }\n    ... on DecisionInputState {\n      input\n    }\n  }\n  questions {\n    __typename\n    ... on DecisionPredicateQuestion {\n      name\n      instructions\n      criteria {\n        true\n        false\n      }\n    }\n    ... on DecisionChoiceQuestion {\n      name\n      instructions\n      choices {\n        value\n        description\n      }\n    }\n    ... on DecisionScaleQuestion {\n      name\n      instructions\n      levels {\n        label\n        description\n      }\n    }\n  }\n  modelName\n  decisionModelProvider: modelProvider\n  customProvider {\n    id\n    name\n  }\n}\n\nfragment DecisionModelConfigurationCard_version on DecisionVersion {\n  modelName\n  decisionModelProvider: modelProvider\n  customProvider {\n    name\n    id\n  }\n}\n\nfragment DecisionVersionDetailsPage__main on DecisionVersion {\n  id\n  metadata\n  decision {\n    id\n    versionTags {\n      id\n      name\n    }\n  }\n  ...DecisionVersionTagsList_data\n  ...DecisionDefinitionCard_version\n  ...DecisionModelConfigurationCard_version\n  ...DecisionCodeExportCard_version\n  previousVersion {\n    ...DecisionDefinitionCard_version\n    id\n  }\n}\n\nfragment DecisionVersionTagsList_data on DecisionVersion {\n  tags {\n    id\n    name\n  }\n}\n\nfragment PromptChatMessagesCard__main on PromptVersion {\n  provider: modelProvider\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                arguments\n                name\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateType\n  templateFormat\n}\n\nfragment PromptCodeExportCard__main on PromptVersion {\n  id\n  invocationParameters {\n    __typename\n    ...PromptInvocationParametersReadableFragment\n  }\n  modelName\n  modelProvider\n  responseFormat {\n    jsonSchema {\n      name\n      description\n      schema\n      strict\n    }\n  }\n  tools {\n    tools {\n      __typename\n      ... on PromptToolFunction {\n        function {\n          name\n          description\n          parameters\n          strict\n        }\n      }\n      ... on PromptToolRaw {\n        raw\n      }\n    }\n    toolChoice {\n      type\n      functionName\n    }\n    disableParallelToolCalls\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            __typename\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            __typename\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            __typename\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateFormat\n  templateType\n}\n\nfragment PromptInvocationParametersReadableFragment on PromptInvocationParameters {\n  __isPromptInvocationParameters: __typename\n  __typename\n  ... on PromptOpenAIInvocationParameters {\n    temperature\n    openaiMaxTokens: maxTokens\n    maxCompletionTokens\n    frequencyPenalty\n    presencePenalty\n    topP\n    seed\n    stop\n    reasoningEffort\n    extraBody\n  }\n  ... on PromptAnthropicInvocationParameters {\n    anthropicMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n    outputConfig {\n      effort\n    }\n    thinking {\n      __typename\n      ... on PromptAnthropicThinkingDisabled {\n        disabled\n      }\n      ... on PromptAnthropicThinkingEnabled {\n        budgetTokens\n        enabledDisplay: display\n      }\n      ... on PromptAnthropicThinkingAdaptive {\n        adaptiveDisplay: display\n      }\n    }\n    extraBody\n  }\n  ... on PromptGoogleInvocationParameters {\n    temperature\n    maxOutputTokens\n    stopSequences\n    presencePenalty\n    frequencyPenalty\n    topP\n    topK\n    thinkingConfig {\n      thinkingBudget\n      thinkingLevel\n      includeThoughts\n    }\n  }\n  ... on PromptAwsInvocationParameters {\n    awsMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n  }\n}\n\nfragment PromptInvocationParameters__main on PromptVersion {\n  invocationParameters {\n    __typename\n    ...PromptInvocationParametersReadableFragment\n  }\n  tools {\n    toolChoice {\n      type\n      functionName\n    }\n  }\n}\n\nfragment PromptLLM__main on PromptVersion {\n  model: modelName\n  provider: modelProvider\n}\n\nfragment PromptModelConfigurationCard__main on PromptVersion {\n  model: modelName\n  provider: modelProvider\n  ...PromptLLM__main\n  ...PromptInvocationParameters__main\n  ...PromptTools__main\n  ...PromptResponseFormatFragment\n}\n\nfragment PromptResponseFormatFragment on PromptVersion {\n  responseFormat {\n    jsonSchema {\n      name\n      description\n      schema\n      strict\n    }\n  }\n}\n\nfragment PromptTools__main on PromptVersion {\n  tools {\n    tools {\n      __typename\n      ... on PromptToolFunction {\n        function {\n          name\n          description\n          parameters\n          strict\n        }\n      }\n      ... on PromptToolRaw {\n        raw\n      }\n    }\n  }\n}\n\nfragment PromptVersionDiffView__template on PromptVersion {\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                arguments\n                name\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n}\n\nfragment PromptVersionMetadataCard__main on PromptVersion {\n  metadata\n}\n\nfragment PromptVersionTagsList_data on PromptVersion {\n  tags {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "dee9938e85dc91d7d9ec66d8e475b415";

export default node;
