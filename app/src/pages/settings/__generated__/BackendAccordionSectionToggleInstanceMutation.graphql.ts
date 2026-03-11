/**
 * @generated SignedSource<<738fc7078cc654eef6a8b8586cb1d2fa>>
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
export type BackendAccordionSectionToggleInstanceMutation$variables = {
  input: UpdateSandboxConfigInput;
};
export type BackendAccordionSectionToggleInstanceMutation$data = {
  readonly updateSandboxConfig: {
    readonly enabled: boolean;
    readonly id: string;
  };
};
export type BackendAccordionSectionToggleInstanceMutation = {
  response: BackendAccordionSectionToggleInstanceMutation$data;
  variables: BackendAccordionSectionToggleInstanceMutation$variables;
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
        "name": "enabled",
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
    "name": "BackendAccordionSectionToggleInstanceMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "BackendAccordionSectionToggleInstanceMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ebe4785ff3556d797614c39e34472c43",
    "id": null,
    "metadata": {},
    "name": "BackendAccordionSectionToggleInstanceMutation",
    "operationKind": "mutation",
    "text": "mutation BackendAccordionSectionToggleInstanceMutation(\n  $input: UpdateSandboxConfigInput!\n) {\n  updateSandboxConfig(input: $input) {\n    id\n    enabled\n  }\n}\n"
  }
};
})();

(node as any).hash = "23abbfe4dd6a2c84b581ae00ef95230f";

export default node;
