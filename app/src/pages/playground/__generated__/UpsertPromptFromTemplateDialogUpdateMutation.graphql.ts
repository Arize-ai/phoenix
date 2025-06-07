/**
 * @generated SignedSource<<7a92fc495aaa2bb8765693a824c63b98>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AZURE_OPENAI" | "BEDROCK" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type CreateChatPromptVersionInput = {
  promptId: string;
  promptVersion: ChatPromptVersionInput;
  tags?: ReadonlyArray<SetPromptVersionTagInput> | null;
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
export type SetPromptVersionTagInput = {
  description?: string | null;
  name: string;
  promptVersionId: string;
};
export type UpsertPromptFromTemplateDialogUpdateMutation$variables = {
  input: CreateChatPromptVersionInput;
};
export type UpsertPromptFromTemplateDialogUpdateMutation$data = {
  readonly createChatPromptVersion: {
    readonly id: string;
    readonly name: string;
  };
};
export type UpsertPromptFromTemplateDialogUpdateMutation = {
  response: UpsertPromptFromTemplateDialogUpdateMutation$data;
  variables: UpsertPromptFromTemplateDialogUpdateMutation$variables;
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
    "name": "createChatPromptVersion",
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
    "name": "UpsertPromptFromTemplateDialogUpdateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "UpsertPromptFromTemplateDialogUpdateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "5560d38314208ef482b716e9817358fe",
    "id": null,
    "metadata": {},
    "name": "UpsertPromptFromTemplateDialogUpdateMutation",
    "operationKind": "mutation",
    "text": "mutation UpsertPromptFromTemplateDialogUpdateMutation(\n  $input: CreateChatPromptVersionInput!\n) {\n  createChatPromptVersion(input: $input) {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "96205130072396cb213f4fa790a7a6b1";

export default node;
