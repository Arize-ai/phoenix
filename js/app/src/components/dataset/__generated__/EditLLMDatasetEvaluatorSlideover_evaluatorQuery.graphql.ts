/**
 * @generated SignedSource<<cee13baf8a6f1e4dc125457bd80e1d00>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type EditLLMDatasetEvaluatorSlideover_evaluatorQuery$variables = {
  datasetEvaluatorId: string;
  datasetId: string;
};
export type EditLLMDatasetEvaluatorSlideover_evaluatorQuery$data = {
  readonly dataset: {
    readonly datasetEvaluator?: {
      readonly evaluator: {
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
      };
      readonly " $fragmentSpreads": FragmentRefs<"EditLLMDatasetEvaluatorSlideover_evaluator">;
    };
  };
};
export type EditLLMDatasetEvaluatorSlideover_evaluatorQuery = {
  response: EditLLMDatasetEvaluatorSlideover_evaluatorQuery$data;
  variables: EditLLMDatasetEvaluatorSlideover_evaluatorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetEvaluatorId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v3 = [
  {
    "kind": "Variable",
    "name": "datasetEvaluatorId",
    "variableName": "datasetEvaluatorId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = [
  (v4/*:: as any*/),
  (v5/*:: as any*/)
],
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "Prompt",
  "kind": "LinkedField",
  "name": "prompt",
  "plural": false,
  "selections": (v6/*:: as any*/),
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
  "name": "modelName",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "temperature",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frequencyPenalty",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "presencePenalty",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "topP",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "extraBody",
  "storageKey": null
},
v17 = {
  "kind": "InlineFragment",
  "selections": [
    (v12/*:: as any*/),
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
    (v13/*:: as any*/),
    (v14/*:: as any*/),
    (v15/*:: as any*/),
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
    (v16/*:: as any*/)
  ],
  "type": "PromptOpenAIInvocationParameters",
  "abstractKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v19 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "anthropicMaxTokens",
      "args": null,
      "kind": "ScalarField",
      "name": "maxTokens",
      "storageKey": null
    },
    (v12/*:: as any*/),
    (v15/*:: as any*/),
    (v18/*:: as any*/),
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
        (v11/*:: as any*/),
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
    (v16/*:: as any*/)
  ],
  "type": "PromptAnthropicInvocationParameters",
  "abstractKey": null
},
v20 = {
  "kind": "InlineFragment",
  "selections": [
    (v12/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "maxOutputTokens",
      "storageKey": null
    },
    (v18/*:: as any*/),
    (v14/*:: as any*/),
    (v13/*:: as any*/),
    (v15/*:: as any*/),
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
v21 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "awsMaxTokens",
      "args": null,
      "kind": "ScalarField",
      "name": "maxTokens",
      "storageKey": null
    },
    (v12/*:: as any*/),
    (v15/*:: as any*/),
    (v18/*:: as any*/)
  ],
  "type": "PromptAwsInvocationParameters",
  "abstractKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "concreteType": "GenerativeModelCustomProvider",
  "kind": "LinkedField",
  "name": "customProvider",
  "plural": false,
  "selections": (v6/*:: as any*/),
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "strict",
  "storageKey": null
},
v25 = {
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
        (v5/*:: as any*/),
        (v23/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "schema",
          "storageKey": null
        },
        (v24/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "template",
  "plural": false,
  "selections": [
    (v11/*:: as any*/),
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
                (v11/*:: as any*/),
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
                        (v26/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "ToolCallFunction",
                          "kind": "LinkedField",
                          "name": "toolCall",
                          "plural": false,
                          "selections": [
                            (v5/*:: as any*/),
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
                        (v26/*:: as any*/),
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
v28 = {
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
        (v11/*:: as any*/),
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
                (v5/*:: as any*/),
                (v23/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "parameters",
                  "storageKey": null
                },
                (v24/*:: as any*/)
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
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v30 = {
  "kind": "InlineFragment",
  "selections": [
    (v5/*:: as any*/),
    (v29/*:: as any*/),
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
v31 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditLLMDatasetEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v7/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersion",
                            "kind": "LinkedField",
                            "name": "promptVersion",
                            "plural": false,
                            "selections": [
                              (v8/*:: as any*/),
                              {
                                "kind": "InlineDataFragmentSpread",
                                "name": "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion",
                                "selections": [
                                  (v4/*:: as any*/),
                                  (v9/*:: as any*/),
                                  (v10/*:: as any*/),
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
                                          (v11/*:: as any*/),
                                          (v17/*:: as any*/),
                                          (v19/*:: as any*/),
                                          (v20/*:: as any*/),
                                          (v21/*:: as any*/)
                                        ],
                                        "args": null,
                                        "argumentDefinitions": []
                                      }
                                    ],
                                    "storageKey": null
                                  },
                                  (v22/*:: as any*/),
                                  (v25/*:: as any*/),
                                  (v27/*:: as any*/),
                                  (v28/*:: as any*/)
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
                              (v5/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "LLMEvaluator",
                        "abstractKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "EditLLMDatasetEvaluatorSlideover_evaluator"
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Dataset",
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
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "EditLLMDatasetEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v11/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v11/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v7/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersion",
                            "kind": "LinkedField",
                            "name": "promptVersion",
                            "plural": false,
                            "selections": [
                              (v8/*:: as any*/),
                              (v4/*:: as any*/),
                              (v9/*:: as any*/),
                              (v10/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "invocationParameters",
                                "plural": false,
                                "selections": [
                                  (v11/*:: as any*/),
                                  {
                                    "kind": "TypeDiscriminator",
                                    "abstractKey": "__isPromptInvocationParameters"
                                  },
                                  (v17/*:: as any*/),
                                  (v19/*:: as any*/),
                                  (v20/*:: as any*/),
                                  (v21/*:: as any*/)
                                ],
                                "storageKey": null
                              },
                              (v22/*:: as any*/),
                              (v25/*:: as any*/),
                              (v27/*:: as any*/),
                              (v28/*:: as any*/)
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
                              (v5/*:: as any*/),
                              (v4/*:: as any*/)
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
                              (v11/*:: as any*/),
                              (v30/*:: as any*/),
                              (v31/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "LLMEvaluator",
                        "abstractKey": null
                      },
                      (v4/*:: as any*/),
                      (v23/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "kind",
                        "storageKey": null
                      },
                      (v5/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
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
                    "name": "outputConfigs",
                    "plural": true,
                    "selections": [
                      (v11/*:: as any*/),
                      (v30/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v5/*:: as any*/),
                          (v29/*:: as any*/),
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
                      (v31/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          },
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f5487dafeaed85819b64f95e7cb61243",
    "id": null,
    "metadata": {},
    "name": "EditLLMDatasetEvaluatorSlideover_evaluatorQuery",
    "operationKind": "query",
    "text": "query EditLLMDatasetEvaluatorSlideover_evaluatorQuery(\n  $datasetId: ID!\n  $datasetEvaluatorId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {\n        evaluator {\n          __typename\n          ... on LLMEvaluator {\n            prompt {\n              id\n              name\n            }\n            promptVersion {\n              templateFormat\n              ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n              id\n            }\n            promptVersionTag {\n              name\n              id\n            }\n          }\n          id\n        }\n        ...EditLLMDatasetEvaluatorSlideover_evaluator\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment EditLLMDatasetEvaluatorSlideover_evaluator on DatasetEvaluator {\n  id\n  name\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  evaluator {\n    __typename\n    description\n    kind\n    name\n    ... on LLMEvaluator {\n      outputConfigs {\n        __typename\n        ... on CategoricalAnnotationConfig {\n          name\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n      prompt {\n        id\n        name\n      }\n      promptVersion {\n        tools {\n          tools {\n            __typename\n            ... on PromptToolFunction {\n              function {\n                parameters\n              }\n            }\n            ... on PromptToolRaw {\n              raw\n            }\n          }\n        }\n        ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment PromptInvocationParametersReadableFragment on PromptInvocationParameters {\n  __isPromptInvocationParameters: __typename\n  __typename\n  ... on PromptOpenAIInvocationParameters {\n    temperature\n    openaiMaxTokens: maxTokens\n    maxCompletionTokens\n    frequencyPenalty\n    presencePenalty\n    topP\n    seed\n    stop\n    reasoningEffort\n    extraBody\n  }\n  ... on PromptAnthropicInvocationParameters {\n    anthropicMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n    outputConfig {\n      effort\n    }\n    thinking {\n      __typename\n      ... on PromptAnthropicThinkingDisabled {\n        disabled\n      }\n      ... on PromptAnthropicThinkingEnabled {\n        budgetTokens\n        enabledDisplay: display\n      }\n      ... on PromptAnthropicThinkingAdaptive {\n        adaptiveDisplay: display\n      }\n    }\n    extraBody\n  }\n  ... on PromptGoogleInvocationParameters {\n    temperature\n    maxOutputTokens\n    stopSequences\n    presencePenalty\n    frequencyPenalty\n    topP\n    topK\n    thinkingConfig {\n      thinkingBudget\n      thinkingLevel\n      includeThoughts\n    }\n  }\n  ... on PromptAwsInvocationParameters {\n    awsMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n  }\n}\n\nfragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion {\n  id\n  modelName\n  modelProvider\n  invocationParameters {\n    __typename\n    ...PromptInvocationParametersReadableFragment\n  }\n  customProvider {\n    id\n    name\n  }\n  responseFormat {\n    jsonSchema {\n      name\n      description\n      schema\n      strict\n    }\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  tools {\n    tools {\n      __typename\n      ... on PromptToolFunction {\n        function {\n          name\n          description\n          parameters\n          strict\n        }\n      }\n      ... on PromptToolRaw {\n        raw\n      }\n    }\n    toolChoice {\n      type\n      functionName\n    }\n    disableParallelToolCalls\n  }\n}\n"
  }
};
})();

(node as any).hash = "ff27ce93727168be7c8def9a781c7202";

export default node;
