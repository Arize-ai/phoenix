/**
 * @generated SignedSource<<aea3cd1df291e83ca3d71be9fba563ab>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ObjectPermission = "EDIT" | "MANAGE_ACCESS" | "VIEW";
export type PatchPermissionSetInput = {
  id: string;
  name?: string | null;
  permissions?: ReadonlyArray<ObjectPermission> | null;
};
export type SettingsRolesPagePatchMutation$variables = {
  input: PatchPermissionSetInput;
};
export type SettingsRolesPagePatchMutation$data = {
  readonly patchPermissionSet: {
    readonly __typename: "PermissionSetMutationPayload";
  };
};
export type SettingsRolesPagePatchMutation = {
  response: SettingsRolesPagePatchMutation$data;
  variables: SettingsRolesPagePatchMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "PermissionSetMutationPayload",
    "kind": "LinkedField",
    "name": "patchPermissionSet",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
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
    "name": "SettingsRolesPagePatchMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsRolesPagePatchMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "416f6a8276a8383e0314cc056a345a18",
    "id": null,
    "metadata": {},
    "name": "SettingsRolesPagePatchMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsRolesPagePatchMutation(\n  $input: PatchPermissionSetInput!\n) {\n  patchPermissionSet(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "6a96f3a4ba2bc33b5b69f307968a00db";

export default node;
