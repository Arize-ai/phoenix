/**
 * @generated SignedSource<<767976775ee226eb849cf909b42f2897>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, GraphQLSubscription } from 'relay-runtime';
export type ChatCompletionMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type ChatCompletionMessageInput = {
  content: any;
  role: ChatCompletionMessageRole;
};
export type PlaygroundOutputSubscription$variables = {
  messages: ReadonlyArray<ChatCompletionMessageInput>;
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
    "cacheID": "0856059e2e3a28a8fda74106924c480d",
    "id": null,
    "metadata": {},
    "name": "PlaygroundOutputSubscription",
    "operationKind": "subscription",
    "text": "subscription PlaygroundOutputSubscription(\n  $messages: [ChatCompletionMessageInput!]!\n) {\n  chatCompletion(input: {messages: $messages})\n}\n"
  }
};
})();

(node as any).hash = "d760af0f8e18301631ba9dcdb148de0b";

export default node;
