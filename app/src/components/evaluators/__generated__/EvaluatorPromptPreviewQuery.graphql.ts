/**
 * @generated SignedSource<<e74e5e0af1b3f0aff5d0e252f0763b96>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type PromptChatTemplateInput = {
  messages: ReadonlyArray<PromptMessageInput>;
};
export type PromptMessageInput = {
  content: ReadonlyArray<ContentPartInput>;
  role: string;
};
export type ContentPartInput = {
  text?: TextContentValueInput | null;
  toolCall?: ToolCallContentValueInput | null;
  toolResult?: ToolResultContentValueInput | null;
};
export type TextContentValueInput = {
  text: string;
};
export type ToolCallContentValueInput = {
  toolCall: ToolCallFunctionInput;
  toolCallId: string;
};
export type ToolCallFunctionInput = {
  arguments: string;
  name: string;
  type?: string | null;
};
export type ToolResultContentValueInput = {
  result: any;
  toolCallId: string;
};
export type PromptTemplateOptions = {
  format: PromptTemplateFormat;
  variables: any;
};
export type EvaluatorPromptPreviewQuery$variables = {
  template: PromptChatTemplateInput;
  templateOptions: PromptTemplateOptions;
};
export type EvaluatorPromptPreviewQuery$data = {
  readonly prompt: {
    readonly messages: ReadonlyArray<{
      readonly content: ReadonlyArray<{
        readonly __typename: "TextContentPart";
        readonly text: {
          readonly text: string;
        };
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      }>;
      readonly role: PromptMessageRole;
    }>;
  };
};
export type EvaluatorPromptPreviewQuery = {
  response: EvaluatorPromptPreviewQuery$data;
  variables: EvaluatorPromptPreviewQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "template"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "templateOptions"
  }
],
v1 = [
  {
    "alias": "prompt",
    "args": [
      {
        "kind": "Variable",
        "name": "template",
        "variableName": "template"
      },
      {
        "kind": "Variable",
        "name": "templateOptions",
        "variableName": "templateOptions"
      }
    ],
    "concreteType": "PromptChatTemplate",
    "kind": "LinkedField",
    "name": "applyChatTemplate",
    "plural": false,
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
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorPromptPreviewQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EvaluatorPromptPreviewQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "5af2f40ebddca4f5c3a13ab452f32188",
    "id": null,
    "metadata": {},
    "name": "EvaluatorPromptPreviewQuery",
    "operationKind": "query",
    "text": "query EvaluatorPromptPreviewQuery(\n  $template: PromptChatTemplateInput!\n  $templateOptions: PromptTemplateOptions!\n) {\n  prompt: applyChatTemplate(template: $template, templateOptions: $templateOptions) {\n    messages {\n      role\n      content {\n        __typename\n        ... on TextContentPart {\n          text {\n            text\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ea8f766e54d53fc5747a3bb0a68aa6bb";

export default node;
