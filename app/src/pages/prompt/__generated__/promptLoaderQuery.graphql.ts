/**
 * @generated SignedSource<<9a8b87f6de97c5e61c9e81b33971aba7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type promptLoaderQuery$variables = {
  id: string;
};
export type promptLoaderQuery$data = {
  readonly prompt: {
    readonly __typename: string;
    readonly id: string;
    readonly name?: string;
    readonly " $fragmentSpreads": FragmentRefs<"PromptIndexPage__main" | "PromptLayout__main" | "PromptVersionsPageContent__main">;
  };
};
export type promptLoaderQuery = {
  response: promptLoaderQuery$data;
  variables: promptLoaderQuery$variables;
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
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
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
  "name": "description",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sequenceNumber",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "user",
  "plural": false,
  "selections": [
    (v3/*: any*/),
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
v11 = [
  (v3/*: any*/),
  (v4/*: any*/)
],
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "PromptVersionTag",
  "kind": "LinkedField",
  "name": "tags",
  "plural": true,
  "selections": (v11/*: any*/),
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "promptLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
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
              (v4/*: any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptIndexPage__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptVersionsPageContent__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptLayout__main"
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
    "name": "promptLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
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
              (v4/*: any*/),
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
                            "kind": "ScalarField",
                            "name": "invocationParameters",
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
                                                  (v5/*: any*/),
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
                                                      (v4/*: any*/)
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
                                                  (v5/*: any*/),
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
                          (v3/*: any*/),
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
                            "concreteType": "ResponseFormat",
                            "kind": "LinkedField",
                            "name": "responseFormat",
                            "plural": false,
                            "selections": (v6/*: any*/),
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
                      },
                      {
                        "alias": "version",
                        "args": null,
                        "concreteType": "PromptVersion",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          (v7/*: any*/),
                          (v8/*: any*/),
                          (v9/*: any*/),
                          (v10/*: any*/),
                          (v12/*: any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v7/*: any*/),
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
                          (v3/*: any*/),
                          (v7/*: any*/),
                          (v9/*: any*/),
                          (v8/*: any*/),
                          (v10/*: any*/),
                          (v12/*: any*/)
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
                "concreteType": "Prompt",
                "kind": "LinkedField",
                "name": "sourcePrompt",
                "plural": false,
                "selections": (v11/*: any*/),
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
    "cacheID": "24ab780c15f1ca153edf38dc98d48034",
    "id": null,
    "metadata": {},
    "name": "promptLoaderQuery",
    "operationKind": "query",
    "text": "query promptLoaderQuery(\n  $id: ID!\n) {\n  prompt: node(id: $id) {\n    __typename\n    id\n    ... on Prompt {\n      name\n      ...PromptIndexPage__main\n      ...PromptVersionsPageContent__main\n      ...PromptLayout__main\n    }\n  }\n}\n\nfragment EditPromptButton_data on Prompt {\n  id\n  description\n}\n\nfragment PromptChatMessagesCard__main on PromptVersion {\n  provider: modelProvider\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                arguments\n                name\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateType\n  templateFormat\n}\n\nfragment PromptCodeExportCard__main on PromptVersion {\n  id\n  invocationParameters\n  modelName\n  modelProvider\n  responseFormat {\n    definition\n  }\n  tools {\n    definition\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            __typename\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            __typename\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            __typename\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateFormat\n  templateType\n}\n\nfragment PromptIndexPage__aside on Prompt {\n  description\n  ...PromptLatestVersionsListFragment\n  ...EditPromptButton_data\n}\n\nfragment PromptIndexPage__main on Prompt {\n  promptVersions {\n    edges {\n      node {\n        ...PromptInvocationParameters__main\n        ...PromptChatMessagesCard__main\n        ...PromptCodeExportCard__main\n        ...PromptModelConfigurationCard__main\n        id\n      }\n    }\n  }\n  ...PromptIndexPage__aside\n}\n\nfragment PromptInvocationParameters__main on PromptVersion {\n  invocationParameters\n}\n\nfragment PromptLLM__main on PromptVersion {\n  model: modelName\n  provider: modelProvider\n}\n\nfragment PromptLatestVersionsListFragment on Prompt {\n  latestVersions: promptVersions(first: 5) {\n    edges {\n      version: node {\n        id\n        description\n        createdAt\n        sequenceNumber\n        ...PromptVersionSummaryFragment\n      }\n    }\n  }\n}\n\nfragment PromptLayout__main on Prompt {\n  id\n  name\n  description\n  sourcePrompt {\n    id\n    name\n  }\n  promptVersions {\n    edges {\n      node {\n        id\n      }\n    }\n  }\n}\n\nfragment PromptModelConfigurationCard__main on PromptVersion {\n  model: modelName\n  provider: modelProvider\n  ...PromptLLM__main\n  ...PromptInvocationParameters__main\n  ...PromptTools__main\n  ...PromptResponseFormatFragment\n}\n\nfragment PromptResponseFormatFragment on PromptVersion {\n  responseFormat {\n    definition\n  }\n}\n\nfragment PromptTools__main on PromptVersion {\n  tools {\n    definition\n  }\n}\n\nfragment PromptVersionSummaryFragment on PromptVersion {\n  id\n  description\n  sequenceNumber\n  createdAt\n  user {\n    id\n    username\n    profilePictureUrl\n  }\n  ...PromptVersionTagsList_data\n}\n\nfragment PromptVersionTagsList_data on PromptVersion {\n  tags {\n    id\n    name\n  }\n}\n\nfragment PromptVersionsList__main on Prompt {\n  promptVersions {\n    edges {\n      version: node {\n        id\n        ...PromptVersionSummaryFragment\n      }\n    }\n  }\n}\n\nfragment PromptVersionsPageContent__main on Prompt {\n  ...PromptVersionsList__main\n}\n"
  }
};
})();

(node as any).hash = "c19209c9d3b9df985746493df3a97b49";

export default node;
