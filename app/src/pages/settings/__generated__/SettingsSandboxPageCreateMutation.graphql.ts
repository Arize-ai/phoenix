/**
 * @generated SignedSource<<b8bfd0922bad223926ed8b5316b3423a>>
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
  timeout?: number;
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
    "cacheID": "7fe7e61681df825cb308be10d2fdafab",
    "id": null,
    "metadata": {},
    "name": "SettingsSandboxPageCreateMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsSandboxPageCreateMutation(\n  $input: CreateSandboxConfigInput!\n) {\n  createSandboxConfig(input: $input) {\n    id\n    backendType\n    config\n    timeout\n    configHash\n  }\n}\n"
  }
};
})();

(node as any).hash = "339a60c524e4501c007b46549528f5d2";

export default node;
