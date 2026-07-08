/**
 * @generated SignedSource<<e4850e91d1fd53e060ec6749c14195d1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AccessGrantInput = {
  object: AccessGrantObjectInput;
  permissionSetId?: string | null;
  subject: AccessGrantSubjectInput;
};
export type AccessGrantSubjectInput = {
  isEveryone?: boolean | null;
  userGroupId?: string | null;
  userId?: string | null;
};
export type AccessGrantObjectInput = {
  datasetId?: string | null;
  projectId?: string | null;
  promptId?: string | null;
};
export type ResourceAccessFormRevokeMutation$variables = {
  input: AccessGrantInput;
};
export type ResourceAccessFormRevokeMutation$data = {
  readonly revokeAccess: {
    readonly __typename: "AccessGrantMutationPayload";
  };
};
export type ResourceAccessFormRevokeMutation = {
  response: ResourceAccessFormRevokeMutation$data;
  variables: ResourceAccessFormRevokeMutation$variables;
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
    "name": "revokeAccess",
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
    "name": "ResourceAccessFormRevokeMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ResourceAccessFormRevokeMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "be144c62c36a69c7286bdf7bb532f946",
    "id": null,
    "metadata": {},
    "name": "ResourceAccessFormRevokeMutation",
    "operationKind": "mutation",
    "text": "mutation ResourceAccessFormRevokeMutation(\n  $input: AccessGrantInput!\n) {\n  revokeAccess(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "df533f0b158adcb6f6f80a404d562be9";

export default node;
