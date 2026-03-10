/**
 * @generated SignedSource<<b8d23294c26277ea1becfeed9f7e9994>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SandboxBackendType = "DAYTONA" | "E2B" | "VERCEL" | "WASM";
export type CreateSandboxConfigInstanceInput = {
  backendType: SandboxBackendType;
  config?: any | null;
  description?: string | null;
  name: string;
  timeout?: number | null;
};
export type SettingsSandboxPageCreateInstanceMutation$variables = {
  input: CreateSandboxConfigInstanceInput;
};
export type SettingsSandboxPageCreateInstanceMutation$data = {
  readonly createSandboxConfigInstance: {
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
export type SettingsSandboxPageCreateInstanceMutation = {
  response: SettingsSandboxPageCreateInstanceMutation$data;
  variables: SettingsSandboxPageCreateInstanceMutation$variables;
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
    "name": "createSandboxConfigInstance",
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
    "name": "SettingsSandboxPageCreateInstanceMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsSandboxPageCreateInstanceMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "53a987903bb9797c6a96286d469a3ad8",
    "id": null,
    "metadata": {},
    "name": "SettingsSandboxPageCreateInstanceMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsSandboxPageCreateInstanceMutation(\n  $input: CreateSandboxConfigInstanceInput!\n) {\n  createSandboxConfigInstance(input: $input) {\n    id\n    backendType\n    name\n    description\n    config\n    timeout\n    enabled\n    configHash\n  }\n}\n"
  }
};
})();

(node as any).hash = "e0cdd4215c6103f177ad15b7bc2fa544";

export default node;
