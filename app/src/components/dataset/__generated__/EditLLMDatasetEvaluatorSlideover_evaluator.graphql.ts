/**
 * @generated SignedSource<<6c8034b9da94448cee1d66594dfef1e9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type EditLLMDatasetEvaluatorSlideover_evaluator$data = {
  readonly evaluator: {
    readonly description: string | null;
    readonly kind: EvaluatorKind;
    readonly name: string;
    readonly outputConfigs?: ReadonlyArray<{
      readonly name?: string;
      readonly optimizationDirection?: OptimizationDirection;
      readonly values?: ReadonlyArray<{
        readonly label: string;
        readonly score: number | null;
      }>;
    }>;
    readonly prompt?: {
      readonly id: string;
      readonly name: string;
    };
    readonly promptVersion?: {
      readonly tools: {
        readonly tools: ReadonlyArray<{
          readonly function: {
            readonly parameters: any | null;
          };
        }>;
      } | null;
      readonly " $fragmentSpreads": FragmentRefs<"fetchPlaygroundPrompt_promptVersionToInstance_promptVersion">;
    };
  };
  readonly id: string;
  readonly inputMapping: {
    readonly literalMapping: any;
    readonly pathMapping: any;
  };
  readonly name: string;
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
  readonly " $fragmentType": "EditLLMDatasetEvaluatorSlideover_evaluator";
};
export type EditLLMDatasetEvaluatorSlideover_evaluator$key = {
  readonly " $data"?: EditLLMDatasetEvaluatorSlideover_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"EditLLMDatasetEvaluatorSlideover_evaluator">;
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
  "name": "optimizationDirection",
  "storageKey": null
},
v3 = {
  "kind": "InlineFragment",
  "selections": [
    (v1/*: any*/),
    (v2/*: any*/),
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
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v5 = [
  (v0/*: any*/),
  (v1/*: any*/)
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parameters",
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
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "EditLLMDatasetEvaluatorSlideover_evaluator",
  "selections": [
    (v0/*: any*/),
    (v1/*: any*/),
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
        (v3/*: any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            (v1/*: any*/),
            (v2/*: any*/),
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
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "evaluator",
      "plural": false,
      "selections": [
        (v4/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "kind",
          "storageKey": null
        },
        (v1/*: any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": null,
              "kind": "LinkedField",
              "name": "outputConfigs",
              "plural": true,
              "selections": [
                (v3/*: any*/)
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "Prompt",
              "kind": "LinkedField",
              "name": "prompt",
              "plural": false,
              "selections": (v5/*: any*/),
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
                            (v6/*: any*/)
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
                      "selections": (v5/*: any*/),
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
                            (v4/*: any*/),
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
                                (v4/*: any*/),
                                (v6/*: any*/),
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
  "type": "DatasetEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "b9394d8ae53a21cc3fe790aa423c6ff8";

export default node;
