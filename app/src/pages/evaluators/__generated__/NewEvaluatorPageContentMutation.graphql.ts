/**
 * @generated SignedSource<<d56abc06fcf805863c4dcb7796af6505>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type CreateLLMEvaluatorInput = {
  datasetId?: string | null;
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
export type NewEvaluatorPageContentMutation$variables = {
  input: CreateLLMEvaluatorInput;
};
export type NewEvaluatorPageContentMutation$data = {
  readonly createLlmEvaluator: {
    readonly evaluator: {
      readonly id: string;
      readonly name: string;
    };
  };
};
export type NewEvaluatorPageContentMutation = {
  response: NewEvaluatorPageContentMutation$data;
  variables: NewEvaluatorPageContentMutation$variables;
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
    "concreteType": "LLMEvaluatorMutationPayload",
    "kind": "LinkedField",
    "name": "createLlmEvaluator",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "LLMEvaluator",
        "kind": "LinkedField",
        "name": "evaluator",
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
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "NewEvaluatorPageContentMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "NewEvaluatorPageContentMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "c2bbb90f883fbd1fb6f437ab01e163f3",
    "id": null,
    "metadata": {},
    "name": "NewEvaluatorPageContentMutation",
    "operationKind": "mutation",
    "text": "mutation NewEvaluatorPageContentMutation(\n  $input: CreateLLMEvaluatorInput!\n) {\n  createLlmEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a1728c3a803bc7949c1c88b051cf64a8";

export default node;
