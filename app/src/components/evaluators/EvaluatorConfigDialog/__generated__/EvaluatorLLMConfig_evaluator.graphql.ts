/**
 * @generated SignedSource<<451d1fde8fa460aa3a92cf1b71defcd4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type EvaluatorLLMConfig_evaluator$data = {
  readonly id: string;
  readonly kind?: EvaluatorKind;
  readonly name?: string;
  readonly outputConfig?: {
    readonly name: string;
    readonly values: ReadonlyArray<{
      readonly label: string;
      readonly score: number | null;
    }>;
  };
  readonly prompt?: {
    readonly id: string;
    readonly name: string;
  };
  readonly promptVersion?: {
    readonly id: string;
    readonly templateFormat: PromptTemplateFormat;
    readonly " $fragmentSpreads": FragmentRefs<"PromptChatMessagesCard__main" | "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion">;
  };
  readonly " $fragmentSpreads": FragmentRefs<"EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig">;
  readonly " $fragmentType": "EvaluatorLLMConfig_evaluator";
};
export type EvaluatorLLMConfig_evaluator$key = {
  readonly " $data"?: EvaluatorLLMConfig_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"EvaluatorLLMConfig_evaluator">;
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
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "definition",
    "storageKey": null
  }
],
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
  "name": "toolCallId",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "EvaluatorLLMConfig_evaluator",
  "selections": [
    (v0/*: any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        (v1/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "kind",
          "storageKey": null
        }
      ],
      "type": "Evaluator",
      "abstractKey": "__isEvaluator"
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig"
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CategoricalAnnotationConfig",
          "kind": "LinkedField",
          "name": "outputConfig",
          "plural": false,
          "selections": [
            (v1/*: any*/),
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
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "Prompt",
          "kind": "LinkedField",
          "name": "prompt",
          "plural": false,
          "selections": [
            (v0/*: any*/),
            (v1/*: any*/)
          ],
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
            (v0/*: any*/),
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
                  "concreteType": "ResponseFormat",
                  "kind": "LinkedField",
                  "name": "responseFormat",
                  "plural": false,
                  "selections": (v2/*: any*/),
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
                    (v3/*: any*/),
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
                                (v3/*: any*/),
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
                                        (v4/*: any*/),
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
                                        (v4/*: any*/),
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
                  "concreteType": "ToolDefinition",
                  "kind": "LinkedField",
                  "name": "tools",
                  "plural": true,
                  "selections": (v2/*: any*/),
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
        }
      ],
      "type": "LLMEvaluator",
      "abstractKey": null
    }
  ],
  "type": "Node",
  "abstractKey": "__isNode"
};
})();

(node as any).hash = "551542d1d10714f57a055248f878e7de";

export default node;
