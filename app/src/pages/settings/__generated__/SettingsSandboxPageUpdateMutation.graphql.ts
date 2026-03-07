/**
 * @generated SignedSource<<67a3cc47429e13eb03155a6ee5b3ced8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SandboxBackendType = "DAYTONA" | "E2B" | "VERCEL" | "WASM";
export type UpdateSandboxConfigInput = {
  config?: any | null;
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  id: string;
  sessionMode?: boolean | null;
  timeout?: number | null;
};
export type GenerativeCredentialInput = {
  envVarName: string;
  value: string;
};
export type SettingsSandboxPageUpdateMutation$variables = {
  input: UpdateSandboxConfigInput;
};
export type SettingsSandboxPageUpdateMutation$data = {
  readonly updateSandboxConfig: {
    readonly backendType: SandboxBackendType;
    readonly config: any;
    readonly configHash: string;
    readonly id: string;
    readonly sessionMode: boolean;
    readonly timeout: number;
  };
};
export type SettingsSandboxPageUpdateMutation = {
  response: SettingsSandboxPageUpdateMutation$data;
  variables: SettingsSandboxPageUpdateMutation$variables;
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
        "name": "backendType",
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
        "name": "sessionMode",
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
    "name": "SettingsSandboxPageUpdateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsSandboxPageUpdateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ec53e4da64adbcb0150575e27d562ba8",
    "id": null,
    "metadata": {},
    "name": "SettingsSandboxPageUpdateMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsSandboxPageUpdateMutation(\n  $input: UpdateSandboxConfigInput!\n) {\n  updateSandboxConfig(input: $input) {\n    id\n    backendType\n    config\n    timeout\n    sessionMode\n    configHash\n  }\n}\n"
  }
};
})();

(node as any).hash = "804d1e496fe20adee0d42e55e912a484";

export default node;
