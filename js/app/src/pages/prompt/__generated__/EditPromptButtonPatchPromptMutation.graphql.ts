/**
 * @generated SignedSource<<24e1a05539b2ee8d355b9e64b1417ddf>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PatchPromptInput = {
  description?: string | null;
  metadata?: any | null;
  promptId: string;
};
export type EditPromptButtonPatchPromptMutation$variables = {
  input: PatchPromptInput;
};
export type EditPromptButtonPatchPromptMutation$data = {
  readonly patchPrompt: {
    readonly " $fragmentSpreads": FragmentRefs<"PromptIndexPage__main">;
  };
};
export type EditPromptButtonPatchPromptMutation = {
  response: EditPromptButtonPatchPromptMutation$data;
  variables: EditPromptButtonPatchPromptMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
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
  "name": "temperature",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frequencyPenalty",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "presencePenalty",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "topP",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "extraBody",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "strict",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditPromptButtonPatchPromptMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Prompt",
        "kind": "LinkedField",
        "name": "patchPrompt",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "PromptIndexPage__main"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EditPromptButtonPatchPromptMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Prompt",
        "kind": "LinkedField",
        "name": "patchPrompt",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "PromptVersionConnection",
            "kind": "LinkedField",
            "name": "promptVersions",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersionEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersion",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
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
                              (v3/*:: as any*/),
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
                              (v4/*:: as any*/),
                              (v5/*:: as any*/),
                              (v6/*:: as any*/),
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
                              (v7/*:: as any*/)
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
                              (v3/*:: as any*/),
                              (v6/*:: as any*/),
                              (v8/*:: as any*/),
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
                              (v7/*:: as any*/)
                            ],
                            "type": "PromptAnthropicInvocationParameters",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v3/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "maxOutputTokens",
                                "storageKey": null
                              },
                              (v8/*:: as any*/),
                              (v5/*:: as any*/),
                              (v4/*:: as any*/),
                              (v6/*:: as any*/),
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
                              (v3/*:: as any*/),
                              (v6/*:: as any*/),
                              (v8/*:: as any*/)
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
                                      (v9/*:: as any*/),
                                      (v10/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "parameters",
                                        "storageKey": null
                                      },
                                      (v11/*:: as any*/)
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
                                              (v12/*:: as any*/),
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
                                                  (v9/*:: as any*/)
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
                                              (v12/*:: as any*/),
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
                      (v13/*:: as any*/),
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
                              (v9/*:: as any*/),
                              (v10/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "schema",
                                "storageKey": null
                              },
                              (v11/*:: as any*/)
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
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v13/*:: as any*/),
          (v9/*:: as any*/),
          (v10/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "metadata",
            "storageKey": null
          },
          {
            "alias": "latestVersions",
            "args": [
              {
                "kind": "Literal",
                "name": "first",
                "value": 5
              }
            ],
            "concreteType": "PromptVersionConnection",
            "kind": "LinkedField",
            "name": "promptVersions",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersionEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": "version",
                    "args": null,
                    "concreteType": "PromptVersion",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v13/*:: as any*/),
                      (v10/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "createdAt",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "sequenceNumber",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "User",
                        "kind": "LinkedField",
                        "name": "user",
                        "plural": false,
                        "selections": [
                          (v13/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "username",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "profilePictureUrl",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersionTag",
                        "kind": "LinkedField",
                        "name": "tags",
                        "plural": true,
                        "selections": [
                          (v13/*:: as any*/),
                          (v9/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": "promptVersions(first:5)"
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "PromptLabel",
            "kind": "LinkedField",
            "name": "labels",
            "plural": true,
            "selections": [
              (v9/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "color",
                "storageKey": null
              },
              (v13/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3406ad995a34a3c3fcc9824df935ed46",
    "id": null,
    "metadata": {},
    "name": "EditPromptButtonPatchPromptMutation",
    "operationKind": "mutation",
    "text": "mutation EditPromptButtonPatchPromptMutation(\n  $input: PatchPromptInput!\n) {\n  patchPrompt(input: $input) {\n    ...PromptIndexPage__main\n    id\n  }\n}\n\nfragment EditPromptButton_data on Prompt {\n  id\n  description\n  metadata\n}\n\nfragment PromptChatMessagesCard__main on PromptVersion {\n  provider: modelProvider\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                arguments\n                name\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateType\n  templateFormat\n}\n\nfragment PromptCodeExportCard__main on PromptVersion {\n  id\n  invocationParameters {\n    __typename\n    ...PromptInvocationParametersReadableFragment\n  }\n  modelName\n  modelProvider\n  responseFormat {\n    jsonSchema {\n      name\n      description\n      schema\n      strict\n    }\n  }\n  tools {\n    tools {\n      __typename\n      ... on PromptToolFunction {\n        function {\n          name\n          description\n          parameters\n          strict\n        }\n      }\n      ... on PromptToolRaw {\n        raw\n      }\n    }\n    toolChoice {\n      type\n      functionName\n    }\n    disableParallelToolCalls\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            __typename\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            __typename\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            __typename\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateFormat\n  templateType\n}\n\nfragment PromptIndexPage__aside on Prompt {\n  id\n  name\n  description\n  metadata\n  ...PromptLatestVersionsListFragment\n  ...EditPromptButton_data\n  ...PromptLabels\n}\n\nfragment PromptIndexPage__main on Prompt {\n  promptVersions {\n    edges {\n      node {\n        ...PromptInvocationParameters__main\n        ...PromptChatMessagesCard__main\n        ...PromptCodeExportCard__main\n        ...PromptModelConfigurationCard__main\n        id\n      }\n    }\n  }\n  ...PromptIndexPage__aside\n}\n\nfragment PromptInvocationParametersReadableFragment on PromptInvocationParameters {\n  __isPromptInvocationParameters: __typename\n  __typename\n  ... on PromptOpenAIInvocationParameters {\n    temperature\n    openaiMaxTokens: maxTokens\n    maxCompletionTokens\n    frequencyPenalty\n    presencePenalty\n    topP\n    seed\n    stop\n    reasoningEffort\n    extraBody\n  }\n  ... on PromptAnthropicInvocationParameters {\n    anthropicMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n    outputConfig {\n      effort\n    }\n    thinking {\n      __typename\n      ... on PromptAnthropicThinkingDisabled {\n        disabled\n      }\n      ... on PromptAnthropicThinkingEnabled {\n        budgetTokens\n        enabledDisplay: display\n      }\n      ... on PromptAnthropicThinkingAdaptive {\n        adaptiveDisplay: display\n      }\n    }\n    extraBody\n  }\n  ... on PromptGoogleInvocationParameters {\n    temperature\n    maxOutputTokens\n    stopSequences\n    presencePenalty\n    frequencyPenalty\n    topP\n    topK\n    thinkingConfig {\n      thinkingBudget\n      thinkingLevel\n      includeThoughts\n    }\n  }\n  ... on PromptAwsInvocationParameters {\n    awsMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n  }\n}\n\nfragment PromptInvocationParameters__main on PromptVersion {\n  invocationParameters {\n    __typename\n    ...PromptInvocationParametersReadableFragment\n  }\n  tools {\n    toolChoice {\n      type\n      functionName\n    }\n  }\n}\n\nfragment PromptLLM__main on PromptVersion {\n  model: modelName\n  provider: modelProvider\n}\n\nfragment PromptLabels on Prompt {\n  labels {\n    name\n    color\n    id\n  }\n}\n\nfragment PromptLatestVersionsListFragment on Prompt {\n  latestVersions: promptVersions(first: 5) {\n    edges {\n      version: node {\n        id\n        description\n        createdAt\n        sequenceNumber\n        ...PromptVersionSummaryFragment\n      }\n    }\n  }\n}\n\nfragment PromptModelConfigurationCard__main on PromptVersion {\n  model: modelName\n  provider: modelProvider\n  ...PromptLLM__main\n  ...PromptInvocationParameters__main\n  ...PromptTools__main\n  ...PromptResponseFormatFragment\n}\n\nfragment PromptResponseFormatFragment on PromptVersion {\n  responseFormat {\n    jsonSchema {\n      name\n      description\n      schema\n      strict\n    }\n  }\n}\n\nfragment PromptTools__main on PromptVersion {\n  tools {\n    tools {\n      __typename\n      ... on PromptToolFunction {\n        function {\n          name\n          description\n          parameters\n          strict\n        }\n      }\n      ... on PromptToolRaw {\n        raw\n      }\n    }\n  }\n}\n\nfragment PromptVersionSummaryFragment on PromptVersion {\n  id\n  description\n  sequenceNumber\n  createdAt\n  user {\n    id\n    username\n    profilePictureUrl\n  }\n  ...PromptVersionTagsList_data\n}\n\nfragment PromptVersionTagsList_data on PromptVersion {\n  tags {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "3ce25c8fbe5598ec1ee037a9778a6957";

export default node;
