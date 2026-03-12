/**
 * @generated SignedSource<<0696b5aaf67214b81faa9a55792028df>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SandboxBackendType = "DAYTONA" | "DENO" | "E2B" | "VERCEL" | "WASM";
export type CreateSandboxConfigInput = {
  backendType: SandboxBackendType;
  config?: any | null;
  description?: string | null;
  name: string;
  timeout?: number | null;
};
export type CreateInstanceDialogMutation$variables = {
  input: CreateSandboxConfigInput;
};
export type CreateInstanceDialogMutation$data = {
  readonly createSandboxConfig: {
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
export type CreateInstanceDialogMutation = {
  response: CreateInstanceDialogMutation$data;
  variables: CreateInstanceDialogMutation$variables;
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
    "name": "CreateInstanceDialogMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "CreateInstanceDialogMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "8c3156c644ff7d35b80e264a6c0b01ff",
    "id": null,
    "metadata": {},
    "name": "CreateInstanceDialogMutation",
    "operationKind": "mutation",
    "text": "mutation CreateInstanceDialogMutation(\n  $input: CreateSandboxConfigInput!\n) {\n  createSandboxConfig(input: $input) {\n    id\n    backendType\n    name\n    description\n    config\n    timeout\n    enabled\n    configHash\n  }\n}\n"
  }
};
})();

(node as any).hash = "12146c4a691e2a0c6623ba92e8f6b904";

export default node;
