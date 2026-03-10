/**
 * @generated SignedSource<<ffd7700b81a6e97d5c3d927463cd8b79>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SettingsSandboxPageDeleteCredentialMutation$variables = {
  envVarName: string;
};
export type SettingsSandboxPageDeleteCredentialMutation$data = {
  readonly deleteSandboxCredential: boolean;
};
export type SettingsSandboxPageDeleteCredentialMutation = {
  response: SettingsSandboxPageDeleteCredentialMutation$data;
  variables: SettingsSandboxPageDeleteCredentialMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "envVarName"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "envVarName",
        "variableName": "envVarName"
      }
    ],
    "kind": "ScalarField",
    "name": "deleteSandboxCredential",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SettingsSandboxPageDeleteCredentialMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsSandboxPageDeleteCredentialMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "f234a6658a83765b0b1457e2568545f7",
    "id": null,
    "metadata": {},
    "name": "SettingsSandboxPageDeleteCredentialMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsSandboxPageDeleteCredentialMutation(\n  $envVarName: String!\n) {\n  deleteSandboxCredential(envVarName: $envVarName)\n}\n"
  }
};
})();

(node as any).hash = "b97174f2641212f3120231577c67d9e2";

export default node;
