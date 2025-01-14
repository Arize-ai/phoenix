/**
 * @generated SignedSource<<1a22d0484247222e9e135d16b4448ab7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "FSTRING" | "MUSTACHE" | "NONE";
export type PromptTemplateType = "CHAT" | "STRING";
import { FragmentRefs } from "relay-runtime";
export type PromptCodeExportCard__main$data = {
  readonly invocationParameters: any | null;
  readonly modelName: string;
  readonly modelProvider: string;
  readonly outputSchema: {
    readonly definition: any;
  } | null;
  readonly template: {
    readonly __typename: "PromptChatTemplate";
    readonly messages: ReadonlyArray<{
      readonly content?: ReadonlyArray<{
        readonly __typename: "ImagePart";
        readonly image: {
          readonly type: string;
          readonly url: string;
        };
      } | {
        readonly __typename: "TextPart";
        readonly text: string;
        readonly type: string;
      } | {
        readonly __typename: "ToolCallPart";
        readonly toolCall: string;
        readonly type: string;
      } | {
        readonly __typename: "ToolResultPart";
        readonly toolResult: {
          readonly result: any;
          readonly toolCallId: string;
          readonly type: string;
        };
        readonly type: string;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      }>;
      readonly role?: PromptMessageRole;
      readonly textContent?: string;
    }>;
  } | {
    readonly __typename: "PromptStringTemplate";
    readonly template: string;
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
  readonly " $fragmentType": "PromptCodeExportCard__main";
};
export type PromptCodeExportCard__main$key = {
  readonly " $data"?: PromptCodeExportCard__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptCodeExportCard__main">;
};

const node: ReaderFragment = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "definition",
    "storageKey": null
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "role",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "type",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptCodeExportCard__main",
  "selections": [
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
      "concreteType": "JSONSchema",
      "kind": "LinkedField",
      "name": "outputSchema",
      "plural": false,
      "selections": (v0/*: any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "ToolDefinition",
      "kind": "LinkedField",
      "name": "tools",
      "plural": true,
      "selections": (v0/*: any*/),
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
        (v1/*: any*/),
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
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v2/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": null,
                      "kind": "LinkedField",
                      "name": "content",
                      "plural": true,
                      "selections": [
                        (v1/*: any*/),
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
                                (v3/*: any*/),
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
                            (v3/*: any*/),
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
                            (v3/*: any*/),
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
                            (v3/*: any*/),
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "ToolResult",
                              "kind": "LinkedField",
                              "name": "toolResult",
                              "plural": false,
                              "selections": [
                                (v3/*: any*/),
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
                    (v2/*: any*/),
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
      "name": "templateFormat",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "templateType",
      "storageKey": null
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};
})();

(node as any).hash = "4d866d1d13b65891c72d5b5c8e3a4285";

export default node;
