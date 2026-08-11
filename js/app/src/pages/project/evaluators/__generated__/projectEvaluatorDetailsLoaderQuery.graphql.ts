/**
 * @generated SignedSource<<d8be6762e6535732a53ffabc13e1517d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type projectEvaluatorDetailsLoaderQuery$variables = {
  projectEvaluatorId: string;
};
export type projectEvaluatorDetailsLoaderQuery$data = {
  readonly projectEvaluator: {
    readonly __typename: "ProjectEvaluator";
    readonly enabled: boolean;
    readonly evaluator: {
      readonly description: string | null;
      readonly kind: EvaluatorKind;
    };
    readonly id: string;
    readonly name: string;
    readonly " $fragmentSpreads": FragmentRefs<"LLMProjectEvaluatorDetails_projectEvaluator" | "ProjectEvaluatorScopeDetails_projectEvaluator">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type projectEvaluatorDetailsLoaderQuery = {
  response: projectEvaluatorDetailsLoaderQuery$data;
  variables: projectEvaluatorDetailsLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectEvaluatorId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectEvaluatorId"
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
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
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
  "name": "toolCallId",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "projectEvaluatorDetailsLoaderQuery",
    "selections": [
      {
        "alias": "projectEvaluator",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  (v6/*:: as any*/),
                  (v7/*:: as any*/)
                ],
                "storageKey": null
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "ProjectEvaluatorScopeDetails_projectEvaluator"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "LLMProjectEvaluatorDetails_projectEvaluator"
              }
            ],
            "type": "ProjectEvaluator",
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
    "name": "projectEvaluatorDetailsLoaderQuery",
    "selections": [
      {
        "alias": "projectEvaluator",
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
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  (v6/*:: as any*/),
                  (v7/*:: as any*/),
                  (v3/*:: as any*/),
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
                        "selections": [
                          (v3/*:: as any*/),
                          (v4/*:: as any*/)
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
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "parameters",
                                            "storageKey": null
                                          }
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "PromptToolFunction",
                                    "abstractKey": null
                                  }
                                ],
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
                          {
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
                                                  (v14/*:: as any*/),
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
                                                      (v4/*:: as any*/)
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
                                                  (v14/*:: as any*/),
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
                            "kind": "ScalarField",
                            "name": "templateType",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "templateFormat",
                            "storageKey": null
                          },
                          (v3/*:: as any*/)
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
                          (v4/*:: as any*/),
                          (v3/*:: as any*/)
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
                          (v2/*:: as any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v4/*:: as any*/),
                              (v15/*:: as any*/),
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
                              (v4/*:: as any*/),
                              (v15/*:: as any*/),
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
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v4/*:: as any*/),
                              (v15/*:: as any*/)
                            ],
                            "type": "FreeformAnnotationConfig",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v3/*:: as any*/)
                            ],
                            "type": "Node",
                            "abstractKey": "__isNode"
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
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "evaluationTarget",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "filterCondition",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "samplingRate",
                "storageKey": null
              },
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
              }
            ],
            "type": "ProjectEvaluator",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f18f52daf4c636d1195c47b43012f779",
    "id": null,
    "metadata": {},
    "name": "projectEvaluatorDetailsLoaderQuery",
    "operationKind": "query",
    "text": "query projectEvaluatorDetailsLoaderQuery(\n  $projectEvaluatorId: ID!\n) {\n  projectEvaluator: node(id: $projectEvaluatorId) {\n    __typename\n    ... on ProjectEvaluator {\n      id\n      name\n      enabled\n      evaluator {\n        __typename\n        kind\n        description\n        id\n      }\n      ...ProjectEvaluatorScopeDetails_projectEvaluator\n      ...LLMProjectEvaluatorDetails_projectEvaluator\n    }\n    id\n  }\n}\n\nfragment LLMProjectEvaluatorDetails_projectEvaluator on ProjectEvaluator {\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  evaluator {\n    __typename\n    kind\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        invocationParameters {\n          __typename\n          ...PromptInvocationParametersReadableFragment\n        }\n        tools {\n          tools {\n            __typename\n            ... on PromptToolFunction {\n              function {\n                parameters\n              }\n            }\n          }\n        }\n        ...PromptChatMessagesCard__main\n        id\n      }\n      promptVersionTag {\n        name\n        id\n      }\n      outputConfigs {\n        __typename\n        ... on CategoricalAnnotationConfig {\n          name\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          name\n          optimizationDirection\n          lowerBound\n          upperBound\n        }\n        ... on FreeformAnnotationConfig {\n          name\n          optimizationDirection\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ProjectEvaluatorScopeDetails_projectEvaluator on ProjectEvaluator {\n  evaluationTarget\n  filterCondition\n  samplingRate\n}\n\nfragment PromptChatMessagesCard__main on PromptVersion {\n  provider: modelProvider\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                arguments\n                name\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateType\n  templateFormat\n}\n\nfragment PromptInvocationParametersReadableFragment on PromptInvocationParameters {\n  __isPromptInvocationParameters: __typename\n  __typename\n  ... on PromptOpenAIInvocationParameters {\n    temperature\n    openaiMaxTokens: maxTokens\n    maxCompletionTokens\n    frequencyPenalty\n    presencePenalty\n    topP\n    seed\n    stop\n    reasoningEffort\n    extraBody\n  }\n  ... on PromptAnthropicInvocationParameters {\n    anthropicMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n    outputConfig {\n      effort\n    }\n    thinking {\n      __typename\n      ... on PromptAnthropicThinkingDisabled {\n        disabled\n      }\n      ... on PromptAnthropicThinkingEnabled {\n        budgetTokens\n        enabledDisplay: display\n      }\n      ... on PromptAnthropicThinkingAdaptive {\n        adaptiveDisplay: display\n      }\n    }\n    extraBody\n  }\n  ... on PromptGoogleInvocationParameters {\n    temperature\n    maxOutputTokens\n    stopSequences\n    presencePenalty\n    frequencyPenalty\n    topP\n    topK\n    thinkingConfig {\n      thinkingBudget\n      thinkingLevel\n      includeThoughts\n    }\n  }\n  ... on PromptAwsInvocationParameters {\n    awsMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n  }\n}\n"
  }
};
})();

(node as any).hash = "19cd32d57eee75b584335b893573a8e4";

export default node;
