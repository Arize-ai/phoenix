/**
 * @generated SignedSource<<ee9f120f6f671f36d29c72b250c3a48f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EditInstanceDialogDeleteMutation$variables = {
  id: string;
};
export type EditInstanceDialogDeleteMutation$data = {
  readonly deleteSandboxConfig: {
    readonly id: string;
  };
};
export type EditInstanceDialogDeleteMutation = {
  response: EditInstanceDialogDeleteMutation$data;
  variables: EditInstanceDialogDeleteMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "SandboxConfig",
    "kind": "LinkedField",
    "name": "deleteSandboxConfig",
    "plural": false,
    "selections": [
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
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditInstanceDialogDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditInstanceDialogDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "699df9204f22aa57e6c43e6129f786fe",
    "id": null,
    "metadata": {},
    "name": "EditInstanceDialogDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation EditInstanceDialogDeleteMutation(\n  $id: ID!\n) {\n  deleteSandboxConfig(id: $id) {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "ee3975269d765492574c77783ae3f4ab";

export default node;
