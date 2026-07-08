/**
 * @generated SignedSource<<c94f92fb6b0ade1a0643beba5f4acc87>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SettingsGroupsPageRemoveMemberMutation$variables = {
  groupId: number;
  userId: number;
};
export type SettingsGroupsPageRemoveMemberMutation$data = {
  readonly removeUserGroupMember: {
    readonly __typename: "UserGroupMutationPayload";
  };
};
export type SettingsGroupsPageRemoveMemberMutation = {
  response: SettingsGroupsPageRemoveMemberMutation$data;
  variables: SettingsGroupsPageRemoveMemberMutation$variables;
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
    "name": "removeUserGroupMember",
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
    "name": "SettingsGroupsPageRemoveMemberMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsGroupsPageRemoveMemberMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "2a2246bc2c3664eab84392b1123d9187",
    "id": null,
    "metadata": {},
    "name": "SettingsGroupsPageRemoveMemberMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsGroupsPageRemoveMemberMutation(\n  $groupId: Int!\n  $userId: Int!\n) {\n  removeUserGroupMember(groupId: $groupId, userId: $userId) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "19b401f364535e22aa1dc3382aec18e6";

export default node;
