/**
 * @generated SignedSource<<7b791087c02ae4e57c1c2cc77a72faef>>
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
export type CreateChatPromptVersionInput = {
  promptId: string;
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