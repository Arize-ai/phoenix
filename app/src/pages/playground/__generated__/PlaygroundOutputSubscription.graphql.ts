/**
 * @generated SignedSource<<c927619545763b69c4ec17a484dfd329>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, GraphQLSubscription } from 'relay-runtime';
export type ChatCompletionMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "OPENAI";
export type ChatCompletionMessageInput = {
  content: any;
  role: ChatCompletionMessageRole;
};
export type GenerativeModelInput = {
  name: string;
  providerKey: GenerativeProviderKey;
};
export type InvocationParameters = {
  anthropicInvocationParameters?: AnthropicInvocationParameters | null;
  azureOpenaiInvocationParameters?: AzureOpenAIInvocationParameters | null;
  openaiInvocationParameters?: OpenAIInvocationParameters | null;
};
export type OpenAIInvocationParameters = {
  frequencyPenalty?: number | null;
  logitBias?: any | null;
  logprobs?: boolean | null;
  maxCompletionTokens?: number | null;
  metadata?: any | null;
  presencePenalty?: number | null;
  responseFormat?: any | null;
  seed?: number | null;
  stop?: ReadonlyArray<string> | null;
  store?: boolean | null;
  temperature?: number | null;
  topLogprobs?: number | null;
  topP?: number | null;
};
export type AzureOpenAIInvocationParameters = {
  frequencyPenalty?: number | null;
  logitBias?: any | null;
  logprobs?: boolean | null;
  maxTokens?: number | null;
  presencePenalty?: number | null;
  responseFormat?: any | null;
  seed?: number | null;
  stop?: ReadonlyArray<string> | null;
  temperature?: number | null;
  topLogprobs?: number | null;
  topP?: number | null;
};
export type AnthropicInvocationParameters = {
  maxTokens?: number;
  stopSequences?: ReadonlyArray<string> | null;
  temperature?: number | null;
  topK?: number | null;
  topP?: number | null;
};
export type PlaygroundOutputSubscription$variables = {
  apiKey?: string | null;
  invocationParameters: InvocationParameters;
  messages: ReadonlyArray<ChatCompletionMessageInput>;
  model: GenerativeModelInput;
};
export type PlaygroundOutputSubscription$data = {
  readonly chatCompletion: string;
};
export type PlaygroundOutputSubscription = {
  response: PlaygroundOutputSubscription$data;
  variables: PlaygroundOutputSubscription$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "apiKey"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "invocationParameters"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "messages"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "model"
},
v4 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "apiKey",
            "variableName": "apiKey"
          },
          {
            "kind": "Variable",
            "name": "invocationParameters",
            "variableName": "invocationParameters"
          },
          {
            "kind": "Variable",
            "name": "messages",
            "variableName": "messages"
          },
          {
            "kind": "Variable",
            "name": "model",
            "variableName": "model"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "kind": "ScalarField",
    "name": "chatCompletion",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundOutputSubscription",
    "selections": (v4/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v3/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "PlaygroundOutputSubscription",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "6d0368256a4708eceb692fac9b469a70",
    "id": null,
    "metadata": {},
    "name": "PlaygroundOutputSubscription",
    "operationKind": "subscription",
    "text": "subscription PlaygroundOutputSubscription(\n  $messages: [ChatCompletionMessageInput!]!\n  $model: GenerativeModelInput!\n  $invocationParameters: InvocationParameters!\n  $apiKey: String\n) {\n  chatCompletion(input: {messages: $messages, model: $model, invocationParameters: $invocationParameters, apiKey: $apiKey})\n}\n"
  }
};
})();

(node as any).hash = "0ffc0f049247896bfff22a90effc24a9";

export default node;
