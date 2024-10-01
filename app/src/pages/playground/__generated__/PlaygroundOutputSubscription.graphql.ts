/**
 * @generated SignedSource<<f13c38a36104dff25a3eb75b2df7893c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, GraphQLSubscription } from 'relay-runtime';
export type PlaygroundOutputSubscription$variables = {
  message: string;
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
    "name": "message"
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
            "name": "message",
            "variableName": "message"
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
    "cacheID": "9f3d7d595d3974bb015d1b73bff91ff5",
    "id": null,
    "metadata": {},
    "name": "PlaygroundOutputSubscription",
    "operationKind": "subscription",
    "text": "subscription PlaygroundOutputSubscription(\n  $message: String!\n) {\n  chatCompletion(input: {message: $message})\n}\n"
  }
};
})();

(node as any).hash = "e560f1f0d0df600f9f7eb955c25d4ddc";

export default node;
