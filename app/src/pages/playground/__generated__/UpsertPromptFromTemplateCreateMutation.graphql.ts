/**
 * @generated SignedSource<<6783cd06e109ba90663c87f34e2c0736>>
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
export type UpsertPromptFromTemplateCreateMutation$variables = {
  input: CreateChatPromptInput;
};
export type UpsertPromptFromTemplateCreateMutation$data = {
  readonly createChatPrompt: {
    readonly id: string;
    readonly name: string;
  };
};
export type UpsertPromptFromTemplateCreateMutation = {
  response: UpsertPromptFromTemplateCreateMutation$data;
  variables: UpsertPromptFromTemplateCreateMutation$variables;
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
    "name": "UpsertPromptFromTemplateCreateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "UpsertPromptFromTemplateCreateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "53121a20a84375a23093c91dd0e041d8",
    "id": null,
    "metadata": {},
    "name": "UpsertPromptFromTemplateCreateMutation",
    "operationKind": "mutation",
    "text": "mutation UpsertPromptFromTemplateCreateMutation(\n  $input: CreateChatPromptInput!\n) {\n  createChatPrompt(input: $input) {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "e0739fe8e756c744fe87961bae3a2c52";

export default node;
