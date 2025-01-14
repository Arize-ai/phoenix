/**
 * @generated SignedSource<<c101ebb8b1f371dc24a48d65c35b882c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
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
  "name": "role",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "type",
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
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "messages",
                        "plural": true,
                        "selections": [
                          (v2/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v10/*: any*/),
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
                                        "concreteType": "Image",
                                        "kind": "LinkedField",
                                        "name": "image",
                                        "plural": false,
                                        "selections": [
                                          (v11/*: any*/),
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
                                    "type": "ImagePart",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v11/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "text",
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "TextPart",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v11/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "toolCall",
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "ToolCallPart",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      (v11/*: any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "ToolResult",
                                        "kind": "LinkedField",
                                        "name": "toolResult",
                                        "plural": false,
                                        "selections": [
                                          (v11/*: any*/),
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
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "ToolResultPart",
                                    "abstractKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "type": "JSONPromptMessage",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v10/*: any*/),
                              {
                                "alias": "textContent",
                                "args": null,
                                "kind": "ScalarField",
                                "name": "content",
                                "storageKey": null
                              }
                            ],
                            "type": "TextPromptMessage",
                            "abstractKey": null
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
                "concreteType": "JSONSchema",
                "kind": "LinkedField",
                "name": "outputSchema",
                "plural": false,
                "selections": (v7/*: any*/),
                "storageKey": null
              },
              (v8/*: any*/),
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
    "cacheID": "9e1210783ef3258a2f22216b3f3ec3a6",
    "id": null,
    "metadata": {},
    "name": "promptVersionLoaderQuery",
    "operationKind": "query",
    "text": "query promptVersionLoaderQuery(\n  $id: GlobalID!\n) {\n  promptVersion: node(id: $id) {\n    __typename\n    id\n    ... on PromptVersion {\n      ...PromptInvocationParameters__main\n      ...PromptChatMessagesCard__main\n      ...PromptCodeExportCard__main\n      ...PromptModelConfigurationCard__main\n      ...PromptVersionTagsList_data\n      description\n      invocationParameters\n      modelName\n      tools {\n        definition\n      }\n      tags {\n        name\n      }\n    }\n  }\n}\n\nfragment PromptChatMessagesCard__main on PromptVersion {\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        __typename\n        ... on JSONPromptMessage {\n          role\n          content {\n            __typename\n            ... on ImagePart {\n              image {\n                type\n                url\n              }\n            }\n            ... on TextPart {\n              type\n              text\n            }\n            ... on ToolCallPart {\n              type\n              toolCall\n            }\n            ... on ToolResultPart {\n              type\n              toolResult {\n                type\n                toolCallId\n                result\n              }\n            }\n          }\n        }\n        ... on TextPromptMessage {\n          role\n          textContent: content\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateType\n  templateFormat\n}\n\nfragment PromptCodeExportCard__main on PromptVersion {\n  invocationParameters\n  modelName\n  modelProvider\n  outputSchema {\n    definition\n  }\n  tools {\n    definition\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        __typename\n        ... on JSONPromptMessage {\n          role\n          content {\n            __typename\n            ... on ImagePart {\n              image {\n                type\n                url\n              }\n            }\n            ... on TextPart {\n              type\n              text\n            }\n            ... on ToolCallPart {\n              type\n              toolCall\n            }\n            ... on ToolResultPart {\n              type\n              toolResult {\n                type\n                toolCallId\n                result\n              }\n            }\n          }\n        }\n        ... on TextPromptMessage {\n          role\n          textContent: content\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateFormat\n  templateType\n}\n\nfragment PromptInvocationParameters__main on PromptVersion {\n  invocationParameters\n}\n\nfragment PromptModelConfigurationCard__main on PromptVersion {\n  ...PromptInvocationParameters__main\n  ...PromptTools__main\n  ...PromptOutputSchemaFragment\n}\n\nfragment PromptOutputSchemaFragment on PromptVersion {\n  outputSchema {\n    definition\n  }\n}\n\nfragment PromptTools__main on PromptVersion {\n  tools {\n    definition\n  }\n}\n\nfragment PromptVersionTagsList_data on PromptVersion {\n  tags {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "ab4959340d5259ba050f4d3ab7f4e261";

export default node;
