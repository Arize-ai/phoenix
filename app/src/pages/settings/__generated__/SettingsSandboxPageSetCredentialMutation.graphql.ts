/**
 * @generated SignedSource<<44a73d4ab81d0de718c43741e9262ece>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SettingsSandboxPageSetCredentialMutation$variables = {
  envVarName: string;
  value: string;
};
export type SettingsSandboxPageSetCredentialMutation$data = {
  readonly setSandboxCredential: boolean;
};
export type SettingsSandboxPageSetCredentialMutation = {
  response: SettingsSandboxPageSetCredentialMutation$data;
  variables: SettingsSandboxPageSetCredentialMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "envVarName"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "value"
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
      },
      {
        "kind": "Variable",
        "name": "value",
        "variableName": "value"
      }
    ],
    "kind": "ScalarField",
    "name": "setSandboxCredential",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SettingsSandboxPageSetCredentialMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsSandboxPageSetCredentialMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "90990ef276fdc7c0bba9754738099584",
    "id": null,
    "metadata": {},
    "name": "SettingsSandboxPageSetCredentialMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsSandboxPageSetCredentialMutation(\n  $envVarName: String!\n  $value: String!\n) {\n  setSandboxCredential(envVarName: $envVarName, value: $value)\n}\n"
  }
};
})();

(node as any).hash = "c066c223e67a446a4124d3b2ae5952ab";

export default node;
