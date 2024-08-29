/**
 * @generated SignedSource<<aaf1072166ea55075cdd8a0d7b74773c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type LogoutButtonMutation$variables = Record<PropertyKey, never>;
export type LogoutButtonMutation$data = {
  readonly logout: any | null;
};
export type LogoutButtonMutation = {
  response: LogoutButtonMutation$data;
  variables: LogoutButtonMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "logout",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "LogoutButtonMutation",
    "selections": (v0/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "LogoutButtonMutation",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "9d746e0ae12cb3b7a88ea0a0d4da7727",
    "id": null,
    "metadata": {},
    "name": "LogoutButtonMutation",
    "operationKind": "mutation",
    "text": "mutation LogoutButtonMutation {\n  logout\n}\n"
  }
};
})();

(node as any).hash = "573156900cd932369859cbc65bdd1ffa";

export default node;
