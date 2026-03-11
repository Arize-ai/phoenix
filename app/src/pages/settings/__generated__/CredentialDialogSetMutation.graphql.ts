/**
 * @generated SignedSource<<a96ea4b91f990da3394b521678ad3677>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CredentialDialogSetMutation$variables = {
  envVarName: string;
  value: string;
};
export type CredentialDialogSetMutation$data = {
  readonly setSandboxCredential: boolean;
};
export type CredentialDialogSetMutation = {
  response: CredentialDialogSetMutation$data;
  variables: CredentialDialogSetMutation$variables;
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
    "name": "CredentialDialogSetMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "CredentialDialogSetMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "6cca1acbf0f85164ada8eb24bae3e667",
    "id": null,
    "metadata": {},
    "name": "CredentialDialogSetMutation",
    "operationKind": "mutation",
    "text": "mutation CredentialDialogSetMutation(\n  $envVarName: String!\n  $value: String!\n) {\n  setSandboxCredential(envVarName: $envVarName, value: $value)\n}\n"
  }
};
})();

(node as any).hash = "b33d710695f76bc5d23d799606bdc6b3";

export default node;
