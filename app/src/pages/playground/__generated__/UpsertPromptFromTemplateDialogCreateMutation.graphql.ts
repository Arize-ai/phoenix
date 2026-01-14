/**
 * @generated SignedSource<<e7b75c4982202df1a35946ce0dd5bd99>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type PromptTemplateFormat = "F_STRING" | "JSON_PATH" | "MUSTACHE" | "NONE";
export type CreateChatPromptInput = {
  description?: string | null;
  metadata?: any | null;
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
    readonly version: {
      readonly id: string;
    };
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
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
      (v1/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "name",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "PromptVersion",
        "kind": "LinkedField",
        "name": "version",
        "plural": false,
        "selections": [
          (v1/*: any*/)
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
    "name": "UpsertPromptFromTemplateDialogCreateMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "UpsertPromptFromTemplateDialogCreateMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "ed384aa4423c1f5fccce6611d269d532",
    "id": null,
    "metadata": {},
    "name": "UpsertPromptFromTemplateDialogCreateMutation",
    "operationKind": "mutation",
    "text": "mutation UpsertPromptFromTemplateDialogCreateMutation(\n  $input: CreateChatPromptInput!\n) {\n  createChatPrompt(input: $input) {\n    id\n    name\n    version {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "80098dd0b05cefab137107fe4c143c02";

export default node;
