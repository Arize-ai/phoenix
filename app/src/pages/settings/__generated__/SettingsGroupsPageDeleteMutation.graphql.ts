/**
 * @generated SignedSource<<c5d29f7d46a6455c2bac13e20f58dceb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SettingsGroupsPageDeleteMutation$variables = {
  groupId: number;
};
export type SettingsGroupsPageDeleteMutation$data = {
  readonly deleteUserGroup: {
    readonly __typename: "UserGroupMutationPayload";
  };
};
export type SettingsGroupsPageDeleteMutation = {
  response: SettingsGroupsPageDeleteMutation$data;
  variables: SettingsGroupsPageDeleteMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "groupId"
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
      }
    ],
    "concreteType": "UserGroupMutationPayload",
    "kind": "LinkedField",
    "name": "deleteUserGroup",
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
    "name": "SettingsGroupsPageDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsGroupsPageDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "72953b7c38cdfde6080186babfeea4a3",
    "id": null,
    "metadata": {},
    "name": "SettingsGroupsPageDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsGroupsPageDeleteMutation(\n  $groupId: Int!\n) {\n  deleteUserGroup(groupId: $groupId) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "1388fc5620a852db93bee7bde6e92603";

export default node;
