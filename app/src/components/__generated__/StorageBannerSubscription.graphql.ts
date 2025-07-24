/**
 * @generated SignedSource<<7c262f47b10f6e277c8c926d93059bca>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type StorageBannerSubscription$variables = Record<PropertyKey, never>;
export type StorageBannerSubscription$data = {
  readonly insufficientStorage: boolean;
};
export type StorageBannerSubscription = {
  response: StorageBannerSubscription$data;
  variables: StorageBannerSubscription$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "insufficientStorage",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "StorageBannerSubscription",
    "selections": (v0/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "StorageBannerSubscription",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "13a8ef497e724ee3cc33bef3789f838a",
    "id": null,
    "metadata": {},
    "name": "StorageBannerSubscription",
    "operationKind": "subscription",
    "text": "subscription StorageBannerSubscription {\n  insufficientStorage\n}\n"
  }
};
})();

(node as any).hash = "b68e45ebcc1980dd9408bc11fe0a70ee";

export default node;
