/**
 * @generated SignedSource<<4955a8471cbd8cc7ab7fd47d6329c9a3>>
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
    readonly schema: any;
  } | null;
  readonly template: {
    readonly __typename: "PromptChatTemplate";
    readonly messages: ReadonlyArray<{
      readonly content?: string;
      readonly jsonContent?: any;
      readonly role?: PromptMessageRole;
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
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "role",
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
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "schema",
          "storageKey": null
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
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "definition",
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
      "name": "template",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "__typename",
          "storageKey": null
        },
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
                    (v0/*: any*/),
                    {
                      "alias": "jsonContent",
                      "args": null,
                      "kind": "ScalarField",
                      "name": "content",
                      "storageKey": null
                    }
                  ],
                  "type": "JSONPromptMessage",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v0/*: any*/),
                    {
                      "alias": null,
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

(node as any).hash = "f6305f2188d6170391baf5bce0277c69";

export default node;
