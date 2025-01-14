/**
 * @generated SignedSource<<b7805398ca7351a4793a1ee0e613c962>>
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
          readonly outputSchema: {
            readonly definition: any;
          } | null;
          readonly template: {
            readonly __typename: "PromptChatTemplate";
            readonly messages: ReadonlyArray<{
              readonly content: ReadonlyArray<{
                readonly __typename: "ImageContentValue";
                readonly url: string;
              } | {
                readonly __typename: "TextContentValue";
                readonly text: string;
              } | {
                readonly __typename: "ToolCallContentValue";
                readonly toolCall: string;
              } | {
                readonly __typename: "ToolResultContentValue";
                readonly result: any;
                readonly toolCallId: string;
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
              "concreteType": "JSONSchema",
              "kind": "LinkedField",
              "name": "outputSchema",
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
                                  "kind": "ScalarField",
                                  "name": "text",
                                  "storageKey": null
                                }
                              ],
                              "type": "TextContentValue",
                              "abstractKey": null
                            },
                            {
                              "kind": "InlineFragment",
                              "selections": [
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "url",
                                  "storageKey": null
                                }
                              ],
                              "type": "ImageContentValue",
                              "abstractKey": null
                            },
                            {
                              "kind": "InlineFragment",
                              "selections": [
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "toolCall",
                                  "storageKey": null
                                }
                              ],
                              "type": "ToolCallContentValue",
                              "abstractKey": null
                            },
                            {
                              "kind": "InlineFragment",
                              "selections": [
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "toolCallId",
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "result",
                                  "storageKey": null
                                }
                              ],
                              "type": "ToolResultContentValue",
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
              (v8/*: any*/)
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
              (v8/*: any*/)
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
    "cacheID": "6e24202c39cfefb7a0bf3c720d36c4c5",
    "id": null,
    "metadata": {},
    "name": "fetchPlaygroundPromptQuery",
    "operationKind": "query",
    "text": "query fetchPlaygroundPromptQuery(\n  $promptId: GlobalID!\n) {\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      id\n      name\n      createdAt\n      description\n      promptVersions(first: 1) {\n        edges {\n          promptVersion: node {\n            id\n            description\n            modelName\n            modelProvider\n            invocationParameters\n            templateType\n            templateFormat\n            outputSchema {\n              definition\n            }\n            template {\n              __typename\n              ... on PromptChatTemplate {\n                messages {\n                  role\n                  content {\n                    __typename\n                    ... on TextContentValue {\n                      text\n                    }\n                    ... on ImageContentValue {\n                      url\n                    }\n                    ... on ToolCallContentValue {\n                      toolCall\n                    }\n                    ... on ToolResultContentValue {\n                      toolCallId\n                      result\n                    }\n                  }\n                }\n              }\n            }\n            tools {\n              definition\n            }\n          }\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "b7a206bb518411dd99f4d0b035dfce4b";

export default node;
