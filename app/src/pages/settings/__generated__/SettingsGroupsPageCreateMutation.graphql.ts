/**
 * @generated SignedSource<<7ee0a29523bc00c6319869ca6126d9c5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SettingsGroupsPageCreateMutation$variables = {
  name: string;
};
export type SettingsGroupsPageCreateMutation$data = {
  readonly createUserGroup: {
    readonly __typename: "UserGroupMutationPayload";
  };
};
export type SettingsGroupsPageCreateMutation = {
  response: SettingsGroupsPageCreateMutation$data;
  variables: SettingsGroupsPageCreateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "name"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "name",
        "variableName": "name"
      }
    ],
    "concreteType": "UserGroupMutationPayload",
    "kind": "LinkedField",
    "name": "createUserGroup",
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
    "name": "SettingsGroupsPageCreateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsGroupsPageCreateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "9d4daa6ba3027190a0d33ce677fbbb23",
    "id": null,
    "metadata": {},
    "name": "SettingsGroupsPageCreateMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsGroupsPageCreateMutation(\n  $name: String!\n) {\n  createUserGroup(name: $name) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "a10ad21bf9e6912dcbe888ffce4a1c55";

export default node;
