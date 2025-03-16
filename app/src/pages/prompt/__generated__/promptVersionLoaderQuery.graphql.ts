/**
 * @generated SignedSource<<6c54996c132076441777046940c50652>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type promptVersionLoaderQuery$variables = {
  id: string;
};
export type promptVersionLoaderQuery$data = {
  readonly promptVersion: {
    readonly __typename: string;
    readonly description?: string | null;
    readonly id: string;
    readonly invocationParameters?: any | null;
    readonly modelName?: string;
    readonly tags?: ReadonlyArray<{
      readonly name: string;
    }>;
    readonly tools?: ReadonlyArray<{
      readonly definition: any;
    }>;
    readonly " $fragmentSpreads": FragmentRefs<"PromptChatMessagesCard__main" | "PromptCodeExportCard__main" | "PromptInvocationParameters__main" | "PromptModelConfigurationCard__main" | "PromptVersionTagsList_data">;
  };
};
export type promptVersionLoaderQuery = {
  response: promptVersionLoaderQuery$data;
  variables: promptVersionLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
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
  "name": "description",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "invocationParameters",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v7 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "definition",
    "storageKey": null
  }
],
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "ToolDefinition",
  "kind": "LinkedField",
  "name": "tools",
  "plural": true,
  "selections": (v7/*: any*/),
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
  "name": "toolCallId",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "promptVersionLoaderQuery",
    "selections": [
      {
        "alias": "promptVersion",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptInvocationParameters__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptChatMessagesCard__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptCodeExportCard__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptModelConfigurationCard__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptVersionTagsList_data"
              },
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v8/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersionTag",
                "kind": "LinkedField",
                "name": "tags",
                "plural": true,
                "selections": [
                  (v9/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "PromptVersion",
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
    "name": "promptVersionLoaderQuery",
    "selections": [
      {
        "alias": "promptVersion",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*: any*/),
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
                  (v2/*: any*/),
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
                              (v2/*: any*/),
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
                                      (v10/*: any*/),
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
                                          (v9/*: any*/)
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
                                      (v10/*: any*/),
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
              (v6/*: any*/),
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
                "concreteType": "ResponseFormat",
                "kind": "LinkedField",
                "name": "responseFormat",
                "plural": false,
                "selections": (v7/*: any*/),
                "storageKey": null
              },
              (v8/*: any*/),
              {
                "alias": "model",
                "args": null,
                "kind": "ScalarField",
                "name": "modelName",
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
                  (v3/*: any*/),
                  (v9/*: any*/)
                ],
                "storageKey": null
              },
              (v4/*: any*/)
            ],
            "type": "PromptVersion",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4f37a4d04a5a5999d2f9f42875519473",
    "id": null,
    "metadata": {},
    "name": "promptVersionLoaderQuery",
    "operationKind": "query",
    "text": "query promptVersionLoaderQuery(\n  $id: ID!\n) {\n  promptVersion: node(id: $id) {\n    __typename\n    id\n    ... on PromptVersion {\n      ...PromptInvocationParameters__main\n      ...PromptChatMessagesCard__main\n      ...PromptCodeExportCard__main\n      ...PromptModelConfigurationCard__main\n      ...PromptVersionTagsList_data\n      description\n      invocationParameters\n      modelName\n      tools {\n        definition\n      }\n      tags {\n        name\n        id\n      }\n    }\n  }\n}\n\nfragment PromptChatMessagesCard__main on PromptVersion {\n  provider: modelProvider\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                arguments\n                name\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateType\n  templateFormat\n}\n\nfragment PromptCodeExportCard__main on PromptVersion {\n  id\n  invocationParameters\n  modelName\n  modelProvider\n  responseFormat {\n    definition\n  }\n  tools {\n    definition\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            __typename\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            __typename\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            __typename\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateFormat\n  templateType\n}\n\nfragment PromptInvocationParameters__main on PromptVersion {\n  invocationParameters\n}\n\nfragment PromptLLM__main on PromptVersion {\n  model: modelName\n  provider: modelProvider\n}\n\nfragment PromptModelConfigurationCard__main on PromptVersion {\n  model: modelName\n  provider: modelProvider\n  ...PromptLLM__main\n  ...PromptInvocationParameters__main\n  ...PromptTools__main\n  ...PromptResponseFormatFragment\n}\n\nfragment PromptResponseFormatFragment on PromptVersion {\n  responseFormat {\n    definition\n  }\n}\n\nfragment PromptTools__main on PromptVersion {\n  tools {\n    definition\n  }\n}\n\nfragment PromptVersionTagsList_data on PromptVersion {\n  tags {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "df4fcaf877c81b47d2b61098c91e6771";

export default node;
