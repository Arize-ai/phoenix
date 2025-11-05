/**
 * @generated SignedSource<<3d0dc3af443ecb81334dd2139a8cbaeb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type PromptTemplateType = "CHAT" | "STRING";
export type fetchPlaygroundPromptQuery$variables = {
  promptId: string;
  promptVersionId?: string | null;
  tagName?: string | null;
};
export type fetchPlaygroundPromptQuery$data = {
  readonly prompt: {
    readonly createdAt?: string;
    readonly description?: string | null;
    readonly id?: string;
    readonly name?: string;
    readonly version?: {
      readonly description: string | null;
      readonly id: string;
      readonly invocationParameters: any | null;
      readonly modelName: string;
      readonly modelProvider: ModelProvider;
      readonly responseFormat: {
        readonly definition: any;
      } | null;
      readonly tags: ReadonlyArray<{
        readonly name: string;
        readonly promptVersionId: string;
      }>;
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
      readonly tools: ReadonlyArray<{
        readonly definition: any;
      }>;
      readonly " $fragmentSpreads": FragmentRefs<"fetchPlaygroundPrompt_promptVersionToInstance_promptVersion">;
    };
  };
};
export type fetchPlaygroundPromptQuery = {
  response: fetchPlaygroundPromptQuery$data;
  variables: fetchPlaygroundPromptQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptVersionId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "tagName"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "promptId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = [
  {
    "kind": "Variable",
    "name": "tagName",
    "variableName": "tagName"
  },
  {
    "kind": "Variable",
    "name": "versionId",
    "variableName": "promptVersionId"
  }
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "invocationParameters",
  "storageKey": null
},
v10 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "definition",
    "storageKey": null
  }
],
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "ResponseFormat",
  "kind": "LinkedField",
  "name": "responseFormat",
  "plural": false,
  "selections": (v10/*: any*/),
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v14 = {
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
            (v12/*: any*/),
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
                    (v13/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "ToolCallFunction",
                      "kind": "LinkedField",
                      "name": "toolCall",
                      "plural": false,
                      "selections": [
                        (v3/*: any*/),
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
                    (v13/*: any*/),
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
v15 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "template",
  "plural": false,
  "selections": [
    (v12/*: any*/),
    (v14/*: any*/),
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
v16 = {
  "alias": null,
  "args": null,
  "concreteType": "ToolDefinition",
  "kind": "LinkedField",
  "name": "tools",
  "plural": true,
  "selections": (v10/*: any*/),
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateType",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateFormat",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "promptVersionId",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "fetchPlaygroundPromptQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              {
                "alias": null,
                "args": (v6/*: any*/),
                "concreteType": "PromptVersion",
                "kind": "LinkedField",
                "name": "version",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineDataFragmentSpread",
                    "name": "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion",
                    "selections": [
                      (v2/*: any*/),
                      (v7/*: any*/),
                      (v8/*: any*/),
                      (v9/*: any*/),
                      (v11/*: any*/),
                      (v15/*: any*/),
                      (v16/*: any*/)
                    ],
                    "args": null,
                    "argumentDefinitions": []
                  },
                  (v2/*: any*/),
                  (v5/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v9/*: any*/),
                  (v17/*: any*/),
                  (v18/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersionTag",
                    "kind": "LinkedField",
                    "name": "tags",
                    "plural": true,
                    "selections": [
                      (v3/*: any*/),
                      (v19/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v11/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "template",
                    "plural": false,
                    "selections": [
                      (v12/*: any*/),
                      (v14/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v16/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Prompt",
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
    "name": "fetchPlaygroundPromptQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v12/*: any*/),
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              {
                "alias": null,
                "args": (v6/*: any*/),
                "concreteType": "PromptVersion",
                "kind": "LinkedField",
                "name": "version",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v9/*: any*/),
                  (v11/*: any*/),
                  (v15/*: any*/),
                  (v16/*: any*/),
                  (v5/*: any*/),
                  (v17/*: any*/),
                  (v18/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersionTag",
                    "kind": "LinkedField",
                    "name": "tags",
                    "plural": true,
                    "selections": [
                      (v3/*: any*/),
                      (v19/*: any*/),
                      (v2/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Prompt",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "7829e3bdc0bbd6d0362786cf18a72ed5",
    "id": null,
    "metadata": {},
    "name": "fetchPlaygroundPromptQuery",
    "operationKind": "query",
    "text": "query fetchPlaygroundPromptQuery(\n  $promptId: ID!\n  $promptVersionId: ID\n  $tagName: Identifier\n) {\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      id\n      name\n      createdAt\n      description\n      version(versionId: $promptVersionId, tagName: $tagName) {\n        ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n        id\n        description\n        modelName\n        modelProvider\n        invocationParameters\n        templateType\n        templateFormat\n        tags {\n          name\n          promptVersionId\n          id\n        }\n        responseFormat {\n          definition\n        }\n        template {\n          __typename\n          ... on PromptChatTemplate {\n            messages {\n              role\n              content {\n                __typename\n                ... on TextContentPart {\n                  text {\n                    text\n                  }\n                }\n                ... on ToolCallContentPart {\n                  toolCall {\n                    toolCallId\n                    toolCall {\n                      name\n                      arguments\n                    }\n                  }\n                }\n                ... on ToolResultContentPart {\n                  toolResult {\n                    toolCallId\n                    result\n                  }\n                }\n              }\n            }\n          }\n        }\n        tools {\n          definition\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion {\n  id\n  modelName\n  modelProvider\n  invocationParameters\n  responseFormat {\n    definition\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  tools {\n    definition\n  }\n}\n"
  }
};
})();

(node as any).hash = "a0204a89ab80efcd23b2f1bb2f5be1f0";

export default node;
