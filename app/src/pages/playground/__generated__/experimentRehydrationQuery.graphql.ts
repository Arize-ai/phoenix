/**
 * @generated SignedSource<<f216e68a83a7566ed8e2bc8b9d1771f4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type PromptTemplateType = "CHAT" | "STRING";
export type PromptToolChoiceType = "NONE" | "ONE_OR_MORE" | "SPECIFIC_FUNCTION" | "ZERO_OR_MORE";
export type experimentRehydrationQuery$variables = {
  experimentId: string;
};
export type experimentRehydrationQuery$data = {
  readonly node: {
    readonly dataset?: {
      readonly id: string;
    };
    readonly job?: {
      readonly datasetEvaluators: {
        readonly edges: ReadonlyArray<{
          readonly node: {
            readonly id: string;
          };
        }>;
      };
      readonly maxConcurrency: number;
      readonly taskConfig: {
        readonly connection: {
          readonly __typename: "AWSBedrockConnectionConfig";
          readonly endpointUrl: string | null;
          readonly regionName: string | null;
        } | {
          readonly __typename: "AnthropicConnectionConfig";
          readonly baseUrl: string | null;
        } | {
          readonly __typename: "AzureOpenAIConnectionConfig";
          readonly azureEndpoint: string;
          readonly openaiApiType: OpenAIApiType;
        } | {
          readonly __typename: "GoogleGenAIConnectionConfig";
          readonly baseUrl: string | null;
        } | {
          readonly __typename: "OpenAIConnectionConfig";
          readonly baseUrl: string | null;
          readonly openaiApiType: OpenAIApiType;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        } | null;
        readonly customProvider: {
          readonly id: string;
          readonly name: string;
        } | null;
        readonly playgroundConfig: {
          readonly appendedMessagesPath: string | null;
          readonly templateVariablesPath: string | null;
        } | null;
        readonly prompt: {
          readonly invocationParameters: any;
          readonly modelName: string;
          readonly modelProvider: GenerativeProviderKey;
          readonly responseFormat: {
            readonly jsonSchema: {
              readonly description: string | null;
              readonly name: string;
              readonly schema: any | null;
              readonly strict: boolean | null;
            };
          } | null;
          readonly template: {
            readonly __typename: "PromptChatTemplate";
            readonly messages: ReadonlyArray<{
              readonly content: ReadonlyArray<{
                readonly __typename: "TextContentPart";
                readonly text: {
                  readonly text: string;
                };
              } | {
                readonly __typename: "ToolCallContentPart";
                readonly toolCall: {
                  readonly toolCall: {
                    readonly arguments: string;
                    readonly name: string;
                  };
                  readonly toolCallId: string;
                };
              } | {
                readonly __typename: "ToolResultContentPart";
                readonly toolResult: {
                  readonly result: any;
                  readonly toolCallId: string;
                };
              } | {
                // This will never be '%other', but we need some
                // value in case none of the concrete values match.
                readonly __typename: "%other";
              }>;
              readonly role: PromptMessageRole;
            }>;
          } | {
            // This will never be '%other', but we need some
            // value in case none of the concrete values match.
            readonly __typename: "%other";
          };
          readonly templateFormat: PromptTemplateFormat;
          readonly templateType: PromptTemplateType;
          readonly tools: {
            readonly disableParallelToolCalls: boolean | null;
            readonly toolChoice: {
              readonly functionName: string | null;
              readonly type: PromptToolChoiceType;
            } | null;
            readonly tools: ReadonlyArray<{
              readonly function: {
                readonly description: string | null;
                readonly name: string;
                readonly parameters: any;
                readonly strict: boolean | null;
              };
            }>;
          } | null;
        };
        readonly streamModelOutput: boolean;
      } | null;
    } | null;
  };
};
export type experimentRehydrationQuery = {
  response: experimentRehydrationQuery$data;
  variables: experimentRehydrationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "experimentId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = [
  (v2/*: any*/)
],
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "Dataset",
  "kind": "LinkedField",
  "name": "dataset",
  "plural": false,
  "selections": (v3/*: any*/),
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxConcurrency",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetEvaluatorConnection",
  "kind": "LinkedField",
  "name": "datasetEvaluators",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetEvaluatorEdge",
      "kind": "LinkedField",
      "name": "edges",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DatasetEvaluator",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": (v3/*: any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
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
  "concreteType": "PromptConfig",
  "kind": "LinkedField",
  "name": "prompt",
  "plural": false,
  "selections": [
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
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "template",
      "plural": false,
      "selections": [
        (v7/*: any*/),
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
                    (v7/*: any*/),
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
                            (v8/*: any*/),
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "ToolCallFunction",
                              "kind": "LinkedField",
                              "name": "toolCall",
                              "plural": false,
                              "selections": [
                                (v9/*: any*/),
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
                            (v8/*: any*/),
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
                (v9/*: any*/),
                (v10/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "parameters",
                  "storageKey": null
                },
                (v11/*: any*/)
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
            (v9/*: any*/),
            (v10/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "schema",
              "storageKey": null
            },
            (v11/*: any*/)
          ],
          "storageKey": null
        }
      ],
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
      "kind": "ScalarField",
      "name": "modelProvider",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "modelName",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "baseUrl",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "openaiApiType",
  "storageKey": null
},
v15 = [
  (v13/*: any*/)
],
v16 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "connection",
  "plural": false,
  "selections": [
    (v7/*: any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        (v13/*: any*/),
        (v14/*: any*/)
      ],
      "type": "OpenAIConnectionConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "azureEndpoint",
          "storageKey": null
        },
        (v14/*: any*/)
      ],
      "type": "AzureOpenAIConnectionConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": (v15/*: any*/),
      "type": "AnthropicConnectionConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "regionName",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "endpointUrl",
          "storageKey": null
        }
      ],
      "type": "AWSBedrockConnectionConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": (v15/*: any*/),
      "type": "GoogleGenAIConnectionConfig",
      "abstractKey": null
    }
  ],
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "GenerativeModelCustomProvider",
  "kind": "LinkedField",
  "name": "customProvider",
  "plural": false,
  "selections": [
    (v2/*: any*/),
    (v9/*: any*/)
  ],
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "concreteType": "PlaygroundConfig",
  "kind": "LinkedField",
  "name": "playgroundConfig",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "templateVariablesPath",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "appendedMessagesPath",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "streamModelOutput",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "experimentRehydrationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentJob",
                "kind": "LinkedField",
                "name": "job",
                "plural": false,
                "selections": [
                  (v5/*: any*/),
                  (v6/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptTaskConfig",
                    "kind": "LinkedField",
                    "name": "taskConfig",
                    "plural": false,
                    "selections": [
                      (v12/*: any*/),
                      (v16/*: any*/),
                      (v17/*: any*/),
                      (v18/*: any*/),
                      (v19/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Experiment",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "experimentRehydrationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentJob",
                "kind": "LinkedField",
                "name": "job",
                "plural": false,
                "selections": [
                  (v5/*: any*/),
                  (v6/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptTaskConfig",
                    "kind": "LinkedField",
                    "name": "taskConfig",
                    "plural": false,
                    "selections": [
                      (v12/*: any*/),
                      (v16/*: any*/),
                      (v17/*: any*/),
                      (v18/*: any*/),
                      (v19/*: any*/),
                      (v2/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v2/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Experiment",
            "abstractKey": null
          },
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "1ac181a242bce7b7e49603784d880ac7",
    "id": null,
    "metadata": {},
    "name": "experimentRehydrationQuery",
    "operationKind": "query",
    "text": "query experimentRehydrationQuery(\n  $experimentId: ID!\n) {\n  node(id: $experimentId) {\n    __typename\n    ... on Experiment {\n      dataset {\n        id\n      }\n      job {\n        maxConcurrency\n        datasetEvaluators {\n          edges {\n            node {\n              id\n            }\n          }\n        }\n        taskConfig {\n          prompt {\n            templateType\n            templateFormat\n            template {\n              __typename\n              ... on PromptChatTemplate {\n                messages {\n                  role\n                  content {\n                    __typename\n                    ... on TextContentPart {\n                      text {\n                        text\n                      }\n                    }\n                    ... on ToolCallContentPart {\n                      toolCall {\n                        toolCallId\n                        toolCall {\n                          name\n                          arguments\n                        }\n                      }\n                    }\n                    ... on ToolResultContentPart {\n                      toolResult {\n                        toolCallId\n                        result\n                      }\n                    }\n                  }\n                }\n              }\n            }\n            tools {\n              tools {\n                function {\n                  name\n                  description\n                  parameters\n                  strict\n                }\n              }\n              toolChoice {\n                type\n                functionName\n              }\n              disableParallelToolCalls\n            }\n            responseFormat {\n              jsonSchema {\n                name\n                description\n                schema\n                strict\n              }\n            }\n            invocationParameters\n            modelProvider\n            modelName\n          }\n          connection {\n            __typename\n            ... on OpenAIConnectionConfig {\n              baseUrl\n              openaiApiType\n            }\n            ... on AzureOpenAIConnectionConfig {\n              azureEndpoint\n              openaiApiType\n            }\n            ... on AnthropicConnectionConfig {\n              baseUrl\n            }\n            ... on AWSBedrockConnectionConfig {\n              regionName\n              endpointUrl\n            }\n            ... on GoogleGenAIConnectionConfig {\n              baseUrl\n            }\n          }\n          customProvider {\n            id\n            name\n          }\n          playgroundConfig {\n            templateVariablesPath\n            appendedMessagesPath\n          }\n          streamModelOutput\n          id\n        }\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "0571ee0f2dd3e36672abba5fb0a487f4";

export default node;
