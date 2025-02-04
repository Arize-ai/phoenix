/**
 * @generated SignedSource<<0680d1e295a634fa3f28195d43eab1bb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "FSTRING" | "MUSTACHE" | "NONE";
export type PromptTemplateType = "CHAT" | "STRING";
export type fetchPlaygroundPromptQuery$variables = {
  promptId: string;
};
export type fetchPlaygroundPromptQuery$data = {
  readonly prompt: {
    readonly createdAt?: string;
    readonly description?: string | null;
    readonly id?: string;
    readonly name?: string;
    readonly promptVersions?: {
      readonly edges: ReadonlyArray<{
        readonly promptVersion: {
          readonly description: string | null;
          readonly id: string;
          readonly invocationParameters: any | null;
          readonly modelName: string;
          readonly modelProvider: string;
          readonly responseFormat: {
            readonly definition: any;
          } | null;
          readonly template: {
            readonly __typename: "PromptChatTemplate";
            readonly messages: ReadonlyArray<{
              readonly content: ReadonlyArray<{
                readonly __typename: "ImageContentPart";
                readonly image: {
                  readonly url: string;
                };
              } | {
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
        };
      }>;
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
  "args": [
    {
      "kind": "Literal",
      "name": "first",
      "value": 1
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
          "alias": "promptVersion",
          "args": null,
          "concreteType": "PromptVersion",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            (v2/*: any*/),
            (v5/*: any*/),
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
              "concreteType": "OutputSchema",
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
                                  "concreteType": "ImageContentValue",
                                  "kind": "LinkedField",
                                  "name": "image",
                                  "plural": false,
                                  "selections": [
                                    {
                                      "alias": null,
                                      "args": null,
                                      "kind": "ScalarField",
                                      "name": "url",
                                      "storageKey": null
                                    }
                                  ],
                                  "storageKey": null
                                }
                              ],
                              "type": "ImageContentPart",
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
              "concreteType": "ToolDefinition",
              "kind": "LinkedField",
              "name": "tools",
              "plural": true,
              "selections": (v6/*: any*/),
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": "promptVersions(first:1)"
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
              (v9/*: any*/)
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
          (v7/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v9/*: any*/)
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
    "cacheID": "19bd0beec784e42e878698170e75bbf9",
    "id": null,
    "metadata": {},
    "name": "fetchPlaygroundPromptQuery",
    "operationKind": "query",
    "text": "query fetchPlaygroundPromptQuery(\n  $promptId: GlobalID!\n) {\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      id\n      name\n      createdAt\n      description\n      promptVersions(first: 1) {\n        edges {\n          promptVersion: node {\n            id\n            description\n            modelName\n            modelProvider\n            invocationParameters\n            templateType\n            templateFormat\n            responseFormat {\n              definition\n            }\n            template {\n              __typename\n              ... on PromptChatTemplate {\n                messages {\n                  role\n                  content {\n                    __typename\n                    ... on TextContentPart {\n                      text {\n                        text\n                      }\n                    }\n                    ... on ImageContentPart {\n                      image {\n                        url\n                      }\n                    }\n                    ... on ToolCallContentPart {\n                      toolCall {\n                        toolCallId\n                        toolCall {\n                          name\n                          arguments\n                        }\n                      }\n                    }\n                    ... on ToolResultContentPart {\n                      toolResult {\n                        toolCallId\n                        result\n                      }\n                    }\n                  }\n                }\n              }\n            }\n            tools {\n              definition\n            }\n          }\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e90031b9619682499a3e5227b2690cb3";

export default node;
