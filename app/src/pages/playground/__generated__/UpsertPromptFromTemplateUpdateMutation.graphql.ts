/**
 * @generated SignedSource<<7f7badd6e61e0833f2286a6814ee38d2>>
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
export type UpsertPromptFromTemplateUpdateMutation$variables = {
  input: CreateChatPromptVersionInput;
};
export type UpsertPromptFromTemplateUpdateMutation$data = {
  readonly createChatPromptVersion: {
    readonly id: string;
    readonly name: string;
  };
};
export type UpsertPromptFromTemplateUpdateMutation = {
  response: UpsertPromptFromTemplateUpdateMutation$data;
  variables: UpsertPromptFromTemplateUpdateMutation$variables;
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
    "name": "UpsertPromptFromTemplateUpdateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "UpsertPromptFromTemplateUpdateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "f3b00b50407609cf6608e0da94975571",
    "id": null,
    "metadata": {},
    "name": "UpsertPromptFromTemplateUpdateMutation",
    "operationKind": "mutation",
    "text": "mutation UpsertPromptFromTemplateUpdateMutation(\n  $input: CreateChatPromptVersionInput!\n) {\n  createChatPromptVersion(input: $input) {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "9cbb828b1119d5316641d99a0f121619";

export default node;
