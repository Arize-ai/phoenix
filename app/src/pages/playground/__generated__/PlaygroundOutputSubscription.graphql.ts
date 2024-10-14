/**
 * @generated SignedSource<<bf2e177cfcda314b89eb76db663c2175>>
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
export type PlaygroundOutputSubscription$variables = {
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
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "messages"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "model"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundOutputSubscription",
    "selections": (v1/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundOutputSubscription",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "441178357c664007fd0a3713b565dffd",
    "id": null,
    "metadata": {},
    "name": "PlaygroundOutputSubscription",
    "operationKind": "subscription",
    "text": "subscription PlaygroundOutputSubscription(\n  $messages: [ChatCompletionMessageInput!]!\n  $model: GenerativeModelInput!\n) {\n  chatCompletion(input: {messages: $messages, model: $model})\n}\n"
  }
};
})();

(node as any).hash = "7dc12b37e3f80c94a3ca91d20b3292a7";

export default node;
