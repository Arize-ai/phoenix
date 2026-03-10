/**
 * @generated SignedSource<<4c250ad541aa4035ee7679299f3b4f17>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SandboxBackendType = "DAYTONA" | "E2B" | "VERCEL" | "WASM";
export type UpdateSandboxConfigInstanceInput = {
  config?: any | null;
  description?: string | null;
  enabled?: boolean | null;
  id: string;
  name?: string | null;
  timeout?: number | null;
};
export type SettingsSandboxPageUpdateInstanceMutation$variables = {
  input: UpdateSandboxConfigInstanceInput;
};
export type SettingsSandboxPageUpdateInstanceMutation$data = {
  readonly updateSandboxConfigInstance: {
    readonly backendType: SandboxBackendType;
    readonly config: any;
    readonly configHash: string;
    readonly description: string | null;
    readonly enabled: boolean;
    readonly id: string;
    readonly name: string;
    readonly timeout: number;
  };
};
export type SettingsSandboxPageUpdateInstanceMutation = {
  response: SettingsSandboxPageUpdateInstanceMutation$data;
  variables: SettingsSandboxPageUpdateInstanceMutation$variables;
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
    "concreteType": "SandboxConfigInstance",
    "kind": "LinkedField",
    "name": "updateSandboxConfigInstance",
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
        "name": "backendType",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "name",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "description",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "config",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "timeout",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "enabled",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "configHash",
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
    "name": "SettingsSandboxPageUpdateInstanceMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsSandboxPageUpdateInstanceMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "fa863fcaec4670cebe86c0b8f596c7f8",
    "id": null,
    "metadata": {},
    "name": "SettingsSandboxPageUpdateInstanceMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsSandboxPageUpdateInstanceMutation(\n  $input: UpdateSandboxConfigInstanceInput!\n) {\n  updateSandboxConfigInstance(input: $input) {\n    id\n    backendType\n    name\n    description\n    config\n    timeout\n    enabled\n    configHash\n  }\n}\n"
  }
};
})();

(node as any).hash = "326cd099a45c24a75634006c26b3b7c0";

export default node;
