/**
 * @generated SignedSource<<f0f664473a5f40f3ee647328dbbd97fa>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SettingsSandboxPageDeleteInstanceMutation$variables = {
  id: string;
};
export type SettingsSandboxPageDeleteInstanceMutation$data = {
  readonly deleteSandboxConfigInstance: {
    readonly id: string;
  };
};
export type SettingsSandboxPageDeleteInstanceMutation = {
  response: SettingsSandboxPageDeleteInstanceMutation$data;
  variables: SettingsSandboxPageDeleteInstanceMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "SandboxConfigInstance",
    "kind": "LinkedField",
    "name": "deleteSandboxConfigInstance",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
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
    "name": "SettingsSandboxPageDeleteInstanceMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsSandboxPageDeleteInstanceMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "4961c305649ed3a582f2cc2373ac0a13",
    "id": null,
    "metadata": {},
    "name": "SettingsSandboxPageDeleteInstanceMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsSandboxPageDeleteInstanceMutation(\n  $id: ID!\n) {\n  deleteSandboxConfigInstance(id: $id) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "78793b46f865d29f65d0d74f16fb7e75";

export default node;
