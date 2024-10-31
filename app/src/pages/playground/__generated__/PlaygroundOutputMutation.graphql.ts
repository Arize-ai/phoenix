/**
 * @generated SignedSource<<1625448b564cdc9686e2e476083862e0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type CanonicalParameterName = "MAX_COMPLETION_TOKENS" | "RANDOM_SEED" | "RESPONSE_FORMAT" | "STOP_SEQUENCES" | "TEMPERATURE" | "TOOL_CHOICE" | "TOP_P";
export type ChatCompletionMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "OPENAI";
export type TemplateLanguage = "F_STRING" | "MUSTACHE";
export type ChatCompletionInput = {
  apiKey?: string | null;
  invocationParameters?: ReadonlyArray<InvocationParameterInput>;
  messages: ReadonlyArray<ChatCompletionMessageInput>;
  model: GenerativeModelInput;
  template?: TemplateOptions | null;
  tools?: ReadonlyArray<any> | null;
};
export type ChatCompletionMessageInput = {
  content?: any;
  role: ChatCompletionMessageRole;
  toolCallId?: string | null;
  toolCalls?: ReadonlyArray<any> | null;
};
export type GenerativeModelInput = {
  apiVersion?: string | null;
  endpoint?: string | null;
  name: string;
  providerKey: GenerativeProviderKey;
};
export type InvocationParameterInput = {
  canonicalName?: CanonicalParameterName | null;
  invocationName: string;
  valueBool?: boolean | null;
  valueBoolean?: boolean | null;
  valueFloat?: number | null;
  valueInt?: number | null;
  valueJson?: any | null;
  valueString?: string | null;
  valueStringList?: ReadonlyArray<string> | null;
};
export type TemplateOptions = {
  language: TemplateLanguage;
  variables: any;
};
export type PlaygroundOutputMutation$variables = {
  input: ChatCompletionInput;
};
export type PlaygroundOutputMutation$data = {
  readonly generateChatCompletion: string;
};
export type PlaygroundOutputMutation = {
  response: PlaygroundOutputMutation$data;
  variables: PlaygroundOutputMutation$variables;
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
    "kind": "ScalarField",
    "name": "generateChatCompletion",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundOutputMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundOutputMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "85df146ab8ab4b4922db2a52044c1402",
    "id": null,
    "metadata": {},
    "name": "PlaygroundOutputMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundOutputMutation(\n  $input: ChatCompletionInput!\n) {\n  generateChatCompletion(input: $input)\n}\n"
  }
};
})();

(node as any).hash = "716e5bbd57b0c0f64c60d10e26dde769";

export default node;
