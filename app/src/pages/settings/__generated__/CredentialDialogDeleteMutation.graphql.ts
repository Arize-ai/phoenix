/**
 * @generated SignedSource<<0ebe34cff6bf6a7abd58e18294d38ed5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CredentialDialogDeleteMutation$variables = {
  envVarName: string;
};
export type CredentialDialogDeleteMutation$data = {
  readonly deleteSandboxCredential: boolean;
};
export type CredentialDialogDeleteMutation = {
  response: CredentialDialogDeleteMutation$data;
  variables: CredentialDialogDeleteMutation$variables;
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
    "name": "CredentialDialogDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "CredentialDialogDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "7fe1573a655f5085829f313ea0ba7296",
    "id": null,
    "metadata": {},
    "name": "CredentialDialogDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation CredentialDialogDeleteMutation(\n  $envVarName: String!\n) {\n  deleteSandboxCredential(envVarName: $envVarName)\n}\n"
  }
};
})();

(node as any).hash = "aa44a1ddca7205e696c7d660c2e03c0f";

export default node;
