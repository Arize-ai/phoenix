/**
 * @generated SignedSource<<a00fd6464fd74d4350ee3815ac13e3ce>>
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
      readonly optimizationDirection: OptimizationDirection;
      readonly values: ReadonlyArray<{
        readonly label: string;
        readonly score: number | null;
      }>;
    }>;
    readonly prompt?: {
      readonly id: string;
      readonly name: string;
    };
    readonly promptVersion?: {
      readonly tools: ReadonlyArray<{
        readonly definition: any;
      }>;
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
  }> | null;
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
  "kind": "InlineFragment",
  "selections": [
    (v1/*: any*/)
  ],
  "type": "AnnotationConfigBase",
  "abstractKey": "__isAnnotationConfigBase"
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v4 = {
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
},
v5 = [
  (v0/*: any*/),
  (v1/*: any*/)
],
v6 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "definition",
    "storageKey": null
  }
],
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "ToolDefinition",
  "kind": "LinkedField",
  "name": "tools",
  "plural": true,
  "selections": (v6/*: any*/),
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
        (v2/*: any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            (v3/*: any*/),
            (v4/*: any*/)
          ],
          "type": "CategoricalAnnotationConfig",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            (v3/*: any*/),
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
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "description",
          "storageKey": null
        },
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
              "concreteType": "CategoricalAnnotationConfig",
              "kind": "LinkedField",
              "name": "outputConfigs",
              "plural": true,
              "selections": [
                (v2/*: any*/),
                (v3/*: any*/),
                (v4/*: any*/)
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
                (v7/*: any*/),
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
                      "concreteType": "ResponseFormat",
                      "kind": "LinkedField",
                      "name": "responseFormat",
                      "plural": false,
                      "selections": (v6/*: any*/),
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
                    (v7/*: any*/)
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

(node as any).hash = "2e11a9182fcbf96872fb4c59e8aa5bcc";

export default node;
