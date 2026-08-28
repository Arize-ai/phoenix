/**
 * @generated SignedSource<<c2bdcc44b6bc47ac9bac2d9a87a9ea25>>
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
    readonly user: {
      readonly passwordNeedsReset: boolean;
    };
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
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "passwordNeedsReset",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ResetPasswordFormMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "UserMutationPayload",
        "kind": "LinkedField",
        "name": "patchViewer",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "user",
            "plural": false,
            "selections": [
              (v2/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ResetPasswordFormMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "UserMutationPayload",
        "kind": "LinkedField",
        "name": "patchViewer",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "user",
            "plural": false,
            "selections": [
              (v2/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a4d59cbf9668e3ccbb7c9dd2ba101f33",
    "id": null,
    "metadata": {},
    "name": "ResetPasswordFormMutation",
    "operationKind": "mutation",
    "text": "mutation ResetPasswordFormMutation(\n  $input: PatchViewerInput!\n) {\n  patchViewer(input: $input) {\n    user {\n      passwordNeedsReset\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1475962063a395b160c1b469d0d41ad7";

export default node;
