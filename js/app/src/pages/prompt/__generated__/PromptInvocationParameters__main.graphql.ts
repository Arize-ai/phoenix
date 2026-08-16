/**
 * @generated SignedSource<<856b872a0865116aa9ec8d5c8f052cb9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type PromptToolChoiceType = "NONE" | "ONE_OR_MORE" | "SPECIFIC_FUNCTION" | "ZERO_OR_MORE";
import { FragmentRefs } from "relay-runtime";
export type PromptInvocationParameters__main$data = {
  readonly invocationParameters: {
    readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParametersReadableFragment">;
  };
  readonly tools: {
    readonly toolChoice: {
      readonly functionName: string | null;
      readonly type: PromptToolChoiceType;
    } | null;
  } | null;
  readonly " $fragmentType": "PromptInvocationParameters__main";
};
export type PromptInvocationParameters__main$key = {
  readonly " $data"?: PromptInvocationParameters__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParameters__main">;
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
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptInvocationParameters__main",
  "selections": [
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};
})();

(node as any).hash = "5830845ad806e2a809e721a2f823cf1a";

export default node;
