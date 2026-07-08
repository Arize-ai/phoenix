/**
 * @generated SignedSource<<5b6b04459f7ff587f71e957506586864>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AccessObjectType = "DATASET" | "PROJECT" | "PROMPT";
export type TagAccessGrantInput = {
  objectType: AccessObjectType;
  permissionSetId?: string | null;
  subject: AccessGrantSubjectInput;
  tagKey: string;
  tagValue: string;
};
export type AccessGrantSubjectInput = {
  isEveryone?: boolean | null;
  userGroupId?: string | null;
  userId?: string | null;
};
export type SettingsTagGrantsPageRevokeMutation$variables = {
  input: TagAccessGrantInput;
};
export type SettingsTagGrantsPageRevokeMutation$data = {
  readonly revokeTagAccess: {
    readonly __typename: "AccessGrantMutationPayload";
  };
};
export type SettingsTagGrantsPageRevokeMutation = {
  response: SettingsTagGrantsPageRevokeMutation$data;
  variables: SettingsTagGrantsPageRevokeMutation$variables;
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
    "concreteType": "AccessGrantMutationPayload",
    "kind": "LinkedField",
    "name": "revokeTagAccess",
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
    "name": "SettingsTagGrantsPageRevokeMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsTagGrantsPageRevokeMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "313cc89d3ff6338ef4b703327672f5d6",
    "id": null,
    "metadata": {},
    "name": "SettingsTagGrantsPageRevokeMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsTagGrantsPageRevokeMutation(\n  $input: TagAccessGrantInput!\n) {\n  revokeTagAccess(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "d909fe35944a79996d6bbedad5c8e4f6";

export default node;
