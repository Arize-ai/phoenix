/**
 * @generated SignedSource<<e00d0052c3e5a63ccb7fbbc5117b241f>>
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
export type SettingsTagGrantsPageGrantMutation$variables = {
  input: TagAccessGrantInput;
};
export type SettingsTagGrantsPageGrantMutation$data = {
  readonly grantTagAccess: {
    readonly __typename: "AccessGrantMutationPayload";
  };
};
export type SettingsTagGrantsPageGrantMutation = {
  response: SettingsTagGrantsPageGrantMutation$data;
  variables: SettingsTagGrantsPageGrantMutation$variables;
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
    "name": "grantTagAccess",
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
    "name": "SettingsTagGrantsPageGrantMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsTagGrantsPageGrantMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "38aff8c72ce6f8c696a343d5a1db1dc4",
    "id": null,
    "metadata": {},
    "name": "SettingsTagGrantsPageGrantMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsTagGrantsPageGrantMutation(\n  $input: TagAccessGrantInput!\n) {\n  grantTagAccess(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "11541b0d52695d0cc63b4d87d0732b96";

export default node;
