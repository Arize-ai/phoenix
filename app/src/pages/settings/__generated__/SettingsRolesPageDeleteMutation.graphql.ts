/**
 * @generated SignedSource<<cfa9a45d322f27c1f7e76ed64446fc77>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeletePermissionSetInput = {
  id: string;
};
export type SettingsRolesPageDeleteMutation$variables = {
  input: DeletePermissionSetInput;
};
export type SettingsRolesPageDeleteMutation$data = {
  readonly deletePermissionSet: {
    readonly __typename: "PermissionSetMutationPayload";
  };
};
export type SettingsRolesPageDeleteMutation = {
  response: SettingsRolesPageDeleteMutation$data;
  variables: SettingsRolesPageDeleteMutation$variables;
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
    "name": "deletePermissionSet",
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
    "name": "SettingsRolesPageDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsRolesPageDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "7b3f5adda58f2ca2e75ff92c221d06ce",
    "id": null,
    "metadata": {},
    "name": "SettingsRolesPageDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsRolesPageDeleteMutation(\n  $input: DeletePermissionSetInput!\n) {\n  deletePermissionSet(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "1071f0f07e8e6d54e1af945c2fc4862d";

export default node;
