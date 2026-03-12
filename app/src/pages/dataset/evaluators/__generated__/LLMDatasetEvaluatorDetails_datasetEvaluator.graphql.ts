/**
 * @generated SignedSource<<cb138f22d4f840f18b5fa16e509691ae>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type LLMDatasetEvaluatorDetails_datasetEvaluator$data = {
  readonly evaluator: {
    readonly kind: EvaluatorKind;
    readonly prompt?: {
      readonly id: string;
      readonly name: string;
    };
    readonly promptVersion?: {
      readonly modelName: string;
      readonly modelProvider: ModelProvider;
      readonly tools: {
        readonly tools: ReadonlyArray<{
          readonly function: {
            readonly parameters: any | null;
          };
        }>;
      } | null;
      readonly " $fragmentSpreads": FragmentRefs<"PromptChatMessagesCard__main" | "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion">;
    };
    readonly promptVersionTag?: {
      readonly name: string;
    } | null;
  };
  readonly id: string;
  readonly inputMapping: {
    readonly literalMapping: any;
    readonly pathMapping: any;
  };
  readonly outputConfigs: ReadonlyArray<{
    readonly lowerBound?: number | null;
    readonly name?: string;
    readonly optimizationDirection?: OptimizationDirection;
    readonly upperBound?: number | null;
    readonly values?: ReadonlyArray<{
      readonly label: string;
      readonly score: number | null;
    }>;
  }>;
  readonly " $fragmentType": "LLMDatasetEvaluatorDetails_datasetEvaluator";
};
export type LLMDatasetEvaluatorDetails_datasetEvaluator$key = {
  readonly " $data"?: LLMDatasetEvaluatorDetails_datasetEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"LLMDatasetEvaluatorDetails_datasetEvaluator">;
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
v2 = [
  (v0/*: any*/),
  (v1/*: any*/)
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parameters",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "strict",
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
  "name": "toolCallId",
  "storageKey": null
},
v10 = {
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
  "name": "LLMDatasetEvaluatorDetails_datasetEvaluator",
  "selections": [
    (v0/*: any*/),
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
              "selections": (v2/*: any*/),
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
                (v3/*: any*/),
                (v4/*: any*/),
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
                      "concreteType": "PromptToolFunction",
                      "kind": "LinkedField",
                      "name": "tools",
                      "plural": true,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "PromptToolFunctionDefinition",
                          "kind": "LinkedField",
                          "name": "function",
                          "plural": false,
                          "selections": [
                            (v5/*: any*/)
                          ],
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "kind": "InlineDataFragmentSpread",
                  "name": "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion",
                  "selections": [
                    (v0/*: any*/),
                    (v3/*: any*/),
                    (v4/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "invocationParameters",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "GenerativeModelCustomProvider",
                      "kind": "LinkedField",
                      "name": "customProvider",
                      "plural": false,
                      "selections": (v2/*: any*/),
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
                            (v1/*: any*/),
                            (v6/*: any*/),
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "schema",
                              "storageKey": null
                            },
                            (v7/*: any*/)
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
                        (v8/*: any*/),
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
                                    (v8/*: any*/),
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
                                            (v9/*: any*/),
                                            {
                                              "alias": null,
                                              "args": null,
                                              "concreteType": "ToolCallFunction",
                                              "kind": "LinkedField",
                                              "name": "toolCall",
                                              "plural": false,
                                              "selections": [
                                                (v1/*: any*/),
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
                                            (v9/*: any*/),
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
                          "concreteType": "PromptToolFunction",
                          "kind": "LinkedField",
                          "name": "tools",
                          "plural": true,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "PromptToolFunctionDefinition",
                              "kind": "LinkedField",
                              "name": "function",
                              "plural": false,
                              "selections": [
                                (v1/*: any*/),
                                (v6/*: any*/),
                                (v5/*: any*/),
                                (v7/*: any*/)
                              ],
                              "storageKey": null
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
                (v1/*: any*/)
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
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "outputConfigs",
      "plural": true,
      "selections": [
        {
          "kind": "InlineFragment",
          "selections": [
            (v1/*: any*/),
            (v10/*: any*/),
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
            (v1/*: any*/),
            (v10/*: any*/),
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DatasetEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "20f8bb8f0ce840a6a32db31bb27731dd";

export default node;
