/**
 * @generated SignedSource<<d2b6e5da925c4ee1073d4afd660fde9a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
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
      readonly tools: ReadonlyArray<{
        readonly definition: any;
      }>;
      readonly " $fragmentSpreads": FragmentRefs<"fetchPlaygroundPrompt_promptVersionToInstance_promptVersion">;
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
  readonly outputConfig: {
    readonly name: string;
    readonly optimizationDirection: OptimizationDirection;
    readonly values: ReadonlyArray<{
      readonly label: string;
      readonly score: number | null;
    }>;
  } | null;
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
v3 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "definition",
    "storageKey": null
  }
],
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "ToolDefinition",
  "kind": "LinkedField",
  "name": "tools",
  "plural": true,
  "selections": (v3/*: any*/),
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v6 = {
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
                (v4/*: any*/),
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
                      "selections": (v2/*: any*/),
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "ResponseFormat",
                      "kind": "LinkedField",
                      "name": "responseFormat",
                      "plural": false,
                      "selections": (v3/*: any*/),
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
                        (v5/*: any*/),
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
                                    (v5/*: any*/),
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
                                            (v6/*: any*/),
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
                                            (v6/*: any*/),
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
                    (v4/*: any*/)
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
        }
      ],
      "storageKey": null
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
          "kind": "ScalarField",
          "name": "optimizationDirection",
          "storageKey": null
        },
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
    }
  ],
  "type": "DatasetEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "5169645eca85c1f98a0412e6f4120809";

export default node;
