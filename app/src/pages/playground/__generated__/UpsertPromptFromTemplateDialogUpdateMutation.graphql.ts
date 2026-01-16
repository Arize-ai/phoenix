/**
 * @generated SignedSource<<750a468d06bd33151b65761334e8ca2a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type CreateChatPromptVersionInput = {
  promptId: string;
  promptVersion: ChatPromptVersionInput;
  tags?: ReadonlyArray<SetPromptVersionTagInput> | null;
};
export type ChatPromptVersionInput = {
  customProviderId?: string | null;
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
    readonly version: {
      readonly id: string;
    };
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
    "name": "createChatPromptVersion",
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
    "name": "UpsertPromptFromTemplateDialogUpdateMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "UpsertPromptFromTemplateDialogUpdateMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "fcdfc8d4bea005817cf45298e5122ee8",
    "id": null,
    "metadata": {},
    "name": "UpsertPromptFromTemplateDialogUpdateMutation",
    "operationKind": "mutation",
    "text": "mutation UpsertPromptFromTemplateDialogUpdateMutation(\n  $input: CreateChatPromptVersionInput!\n) {\n  createChatPromptVersion(input: $input) {\n    id\n    name\n    version {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0a15550cdbc5a206561a299196c7aacb";

export default node;
