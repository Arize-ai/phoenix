/**
 * @generated SignedSource<<515bce9662b4ee4397090ee8012c8834>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
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
  messages: ReadonlyArray<PromptMessageInput>;
};
export type PromptMessageInput = {
  content: ReadonlyArray<PartInput>;
  role: string;
};
export type PartInput = {
  image?: ImageResultInput | null;
  text?: string | null;
  toolCall?: string | null;
  toolResult?: ToolResultInput | null;
  type: string;
};
export type ImageResultInput = {
  type: string;
  url: string;
};
export type ToolResultInput = {
  result: any;
  toolCallId: string;
  type: string;
};
export type ToolDefinitionInput = {
  definition: any;
};
export type JSONSchemaInput = {
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
