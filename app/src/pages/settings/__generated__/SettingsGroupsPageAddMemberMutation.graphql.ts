/**
 * @generated SignedSource<<92087d2cf9dc8332e24fe8f1e2e48165>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SettingsGroupsPageAddMemberMutation$variables = {
  groupId: number;
  userId: number;
};
export type SettingsGroupsPageAddMemberMutation$data = {
  readonly addUserGroupMember: {
    readonly __typename: "UserGroupMutationPayload";
  };
};
export type SettingsGroupsPageAddMemberMutation = {
  response: SettingsGroupsPageAddMemberMutation$data;
  variables: SettingsGroupsPageAddMemberMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "groupId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "userId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "groupId",
        "variableName": "groupId"
      },
      {
        "kind": "Variable",
        "name": "userId",
        "variableName": "userId"
      }
    ],
    "concreteType": "UserGroupMutationPayload",
    "kind": "LinkedField",
    "name": "addUserGroupMember",
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
    "name": "SettingsGroupsPageAddMemberMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsGroupsPageAddMemberMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "5624fbdd98d252515c1a300b83f1cf16",
    "id": null,
    "metadata": {},
    "name": "SettingsGroupsPageAddMemberMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsGroupsPageAddMemberMutation(\n  $groupId: Int!\n  $userId: Int!\n) {\n  addUserGroupMember(groupId: $groupId, userId: $userId) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "a1ce124b245ca4fb8dbab9d836336165";

export default node;
