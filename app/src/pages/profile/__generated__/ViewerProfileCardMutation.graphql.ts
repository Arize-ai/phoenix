/**
 * @generated SignedSource<<fa7125c23c9fb36eb0c4e50d3efe9600>>
 * @lightSyntaxTransform
 * @nogrep
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
export type ViewerProfileCardMutation$variables = {
  input: PatchViewerInput;
};
export type ViewerProfileCardMutation$data = {
  readonly patchViewer: {
    readonly __typename: "UserMutationPayload";
  };
};
export type ViewerProfileCardMutation = {
  response: ViewerProfileCardMutation$data;
  variables: ViewerProfileCardMutation$variables;
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ViewerProfileCardMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ViewerProfileCardMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "03f161df42c71b5924a8ee665e01cdce",
    "id": null,
    "metadata": {},
    "name": "ViewerProfileCardMutation",
    "operationKind": "mutation",
    "text": "mutation ViewerProfileCardMutation(\n  $input: PatchViewerInput!\n) {\n  patchViewer(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "4a11ca65151d84fe95f636763c91dc68";

export default node;
