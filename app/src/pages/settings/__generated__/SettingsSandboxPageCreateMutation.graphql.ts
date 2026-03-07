/**
 * @generated SignedSource<<d51d37509c56c7bb0709d3119707e8b1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SandboxBackendType = "DAYTONA" | "E2B" | "VERCEL" | "WASM";
export type CreateSandboxConfigInput = {
  backendType: SandboxBackendType;
  config?: any;
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  sessionMode?: boolean;
  timeout?: number;
};
export type GenerativeCredentialInput = {
  envVarName: string;
  value: string;
};
export type SettingsSandboxPageCreateMutation$variables = {
  input: CreateSandboxConfigInput;
};
export type SettingsSandboxPageCreateMutation$data = {
  readonly createSandboxConfig: {
    readonly backendType: SandboxBackendType;
    readonly config: any;
    readonly configHash: string;
    readonly id: string;
    readonly sessionMode: boolean;
    readonly timeout: number;
  };
};
export type SettingsSandboxPageCreateMutation = {
  response: SettingsSandboxPageCreateMutation$data;
  variables: SettingsSandboxPageCreateMutation$variables;
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
    "name": "createSandboxConfig",
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
    "name": "SettingsSandboxPageCreateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsSandboxPageCreateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "23b3f62f5d767c185453dc8ee4109018",
    "id": null,
    "metadata": {},
    "name": "SettingsSandboxPageCreateMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsSandboxPageCreateMutation(\n  $input: CreateSandboxConfigInput!\n) {\n  createSandboxConfig(input: $input) {\n    id\n    backendType\n    config\n    timeout\n    sessionMode\n    configHash\n  }\n}\n"
  }
};
})();

(node as any).hash = "0a3b472ba8fa072045c020f936d5008a";

export default node;
