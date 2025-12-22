/**
 * @generated SignedSource<<24be69c78f00a44b31bb834e58a6484b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type LLMDatasetEvaluatorDetails_evaluator$data = {
  readonly kind: EvaluatorKind;
  readonly prompt: {
    readonly id: string;
    readonly name: string;
  };
  readonly promptVersion: {
    readonly " $fragmentSpreads": FragmentRefs<"fetchPlaygroundPrompt_promptVersionToInstance_promptVersion">;
  };
  readonly promptVersionTag: {
    readonly name: string;
  } | null;
  readonly " $fragmentType": "LLMDatasetEvaluatorDetails_evaluator";
};
export type LLMDatasetEvaluatorDetails_evaluator$key = {
  readonly " $data"?: LLMDatasetEvaluatorDetails_evaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"LLMDatasetEvaluatorDetails_evaluator">;
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
  "name": "LLMDatasetEvaluatorDetails_evaluator",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "kind",
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
};
})();

(node as any).hash = "72f54fcb4f59837e5a1d32ac2af79cd9";

export default node;
