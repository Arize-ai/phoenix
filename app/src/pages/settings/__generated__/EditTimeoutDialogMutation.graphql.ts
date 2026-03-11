/**
 * @generated SignedSource<<24bb106469107ae1950e05f501d0a471>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UpdateSandboxConfigInput = {
  config?: any | null;
  description?: string | null;
  enabled?: boolean | null;
  id: string;
  name?: string | null;
  timeout?: number | null;
};
export type EditTimeoutDialogMutation$variables = {
  input: UpdateSandboxConfigInput;
};
export type EditTimeoutDialogMutation$data = {
  readonly updateSandboxConfig: {
    readonly id: string;
    readonly timeout: number;
  };
};
export type EditTimeoutDialogMutation = {
  response: EditTimeoutDialogMutation$data;
  variables: EditTimeoutDialogMutation$variables;
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
    "concreteType": "SandboxConfig",
    "kind": "LinkedField",
    "name": "updateSandboxConfig",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "timeout",
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
    "name": "EditTimeoutDialogMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditTimeoutDialogMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "d30b570bb2233b554b94837e6359f3ee",
    "id": null,
    "metadata": {},
    "name": "EditTimeoutDialogMutation",
    "operationKind": "mutation",
    "text": "mutation EditTimeoutDialogMutation(\n  $input: UpdateSandboxConfigInput!\n) {\n  updateSandboxConfig(input: $input) {\n    id\n    timeout\n  }\n}\n"
  }
};
})();

(node as any).hash = "1d35656a17f12756d9cdc7b50f65cf7c";

export default node;
