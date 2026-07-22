/**
 * @generated SignedSource<<f6b5abf2608deab38a81138f92e3185c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PatchViewerInput = {
  currentPassword?: string | null;
  newPassword?: string | null;
  newUsername?: string | null;
};
export type ResetPasswordFormMutation$variables = {
  input: PatchViewerInput;
};
export type ResetPasswordFormMutation$data = {
  readonly patchViewer: {
    readonly __typename: "UserMutationPayload";
  };
};
export type ResetPasswordFormMutation = {
  response: ResetPasswordFormMutation$data;
  variables: ResetPasswordFormMutation$variables;
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
    "concreteType": "UserMutationPayload",
    "kind": "LinkedField",
    "name": "patchViewer",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ResetPasswordFormMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ResetPasswordFormMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "d09af5e3a2a3d10f117373e25bef11e6",
    "id": null,
    "metadata": {},
    "name": "ResetPasswordFormMutation",
    "operationKind": "mutation",
    "text": "mutation ResetPasswordFormMutation(\n  $input: PatchViewerInput!\n) {\n  patchViewer(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "f8f5c30b0e00c17cdda7557c73c3c2d3";

export default node;
