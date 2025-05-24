/**
 * @generated SignedSource<<57d8b582d9c12a997e35e0fa0744afc3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OPENAI";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type CreateChatPromptInput = {
  description?: string | null;
  name: string;
  promptVersion: ChatPromptVersionInput;
};
export type ChatPromptVersionInput = {
  description?: string | null;
  invocationParameters?: any;
  modelName: string;
  modelProvider: ModelProvider;
  responseFormat?: ResponseFormatInput | null;
  template: PromptChatTemplateInput;
  templateFormat: PromptTemplateFormat;
  tools?: ReadonlyArray<ToolDefinitionInput>;
};
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
export type ToolDefinitionInput = {
  definition: any;
};
export type ResponseFormatInput = {
  definition: any;
};
export type UpsertPromptFromTemplateDialogCreateMutation$variables = {
  input: CreateChatPromptInput;
};
export type UpsertPromptFromTemplateDialogCreateMutation$data = {
  readonly createChatPrompt: {
    readonly id: string;
    readonly name: string;
  };
};
export type UpsertPromptFromTemplateDialogCreateMutation = {
  response: UpsertPromptFromTemplateDialogCreateMutation$data;
  variables: UpsertPromptFromTemplateDialogCreateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "Prompt",
    "kind": "LinkedField",
    "name": "createChatPrompt",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "name",
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
    "name": "UpsertPromptFromTemplateDialogCreateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "UpsertPromptFromTemplateDialogCreateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "73d9d27e0df3bc27e4af4dd3d77f41fb",
    "id": null,
    "metadata": {},
    "name": "UpsertPromptFromTemplateDialogCreateMutation",
    "operationKind": "mutation",
    "text": "mutation UpsertPromptFromTemplateDialogCreateMutation(\n  $input: CreateChatPromptInput!\n) {\n  createChatPrompt(input: $input) {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "fa52cba6c2bfaa6298a5360253dc9bc5";

export default node;
