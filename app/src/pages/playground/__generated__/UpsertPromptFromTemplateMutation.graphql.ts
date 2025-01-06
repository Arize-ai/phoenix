/**
 * @generated SignedSource<<8b98303c3a9bc32f83d9c97d4c81708b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "FSTRING" | "MUSTACHE" | "NONE";
export type PromptTemplateType = "CHAT" | "STRING";
export type CreateChatPromptInput = {
  description?: string | null;
  name: string;
  promptVersion: ChatPromptVersionInput;
};
export type ChatPromptVersionInput = {
  description?: string | null;
  invocationParameters?: any;
  modelName: string;
  modelProvider: string;
  outputSchema?: JSONSchemaInput | null;
  template: PromptChatTemplateInput;
  templateFormat: PromptTemplateFormat;
  templateType: PromptTemplateType;
  tools?: ReadonlyArray<ToolDefinitionInput>;
};
export type PromptChatTemplateInput = {
  messages: ReadonlyArray<TextPromptMessageInput>;
};
export type TextPromptMessageInput = {
  content: string;
  role: PromptMessageRole;
};
export type ToolDefinitionInput = {
  definition: any;
};
export type JSONSchemaInput = {
  definition: any;
};
export type UpsertPromptFromTemplateMutation$variables = {
  input: CreateChatPromptInput;
};
export type UpsertPromptFromTemplateMutation$data = {
  readonly createChatPrompt: {
    readonly id: string;
    readonly name: string;
  };
};
export type UpsertPromptFromTemplateMutation = {
  response: UpsertPromptFromTemplateMutation$data;
  variables: UpsertPromptFromTemplateMutation$variables;
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
    "name": "UpsertPromptFromTemplateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "UpsertPromptFromTemplateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "e5cd5681058827c0e6e52e78ce21cd97",
    "id": null,
    "metadata": {},
    "name": "UpsertPromptFromTemplateMutation",
    "operationKind": "mutation",
    "text": "mutation UpsertPromptFromTemplateMutation(\n  $input: CreateChatPromptInput!\n) {\n  createChatPrompt(input: $input) {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "af85007a733c3ddda31af9383dcde4b9";

export default node;
