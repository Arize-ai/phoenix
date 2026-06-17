/**
 * @generated SignedSource<<e92b7dc45f3d9775c0e6dbe1f50476b3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ObjectPermission = "EDIT" | "MANAGE_ACCESS" | "VIEW";
export type CreatePermissionSetInput = {
  name: string;
  permissions: ReadonlyArray<ObjectPermission>;
};
export type SettingsRolesPageCreateMutation$variables = {
  input: CreatePermissionSetInput;
};
export type SettingsRolesPageCreateMutation$data = {
  readonly createPermissionSet: {
    readonly __typename: "PermissionSetMutationPayload";
  };
};
export type SettingsRolesPageCreateMutation = {
  response: SettingsRolesPageCreateMutation$data;
  variables: SettingsRolesPageCreateMutation$variables;
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
    "name": "createPermissionSet",
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
    "name": "SettingsRolesPageCreateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsRolesPageCreateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "9b92fe9e6950be00fef37ba58a5845a8",
    "id": null,
    "metadata": {},
    "name": "SettingsRolesPageCreateMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsRolesPageCreateMutation(\n  $input: CreatePermissionSetInput!\n) {\n  createPermissionSet(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "65cd1dd205d0b9f8a93e5699d0ea2822";

export default node;
