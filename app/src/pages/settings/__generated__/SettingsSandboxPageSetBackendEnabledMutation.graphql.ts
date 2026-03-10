/**
 * @generated SignedSource<<9fd74e86d21339bcb8ee5321008c7d3a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SandboxBackendType = "DAYTONA" | "E2B" | "VERCEL" | "WASM";
export type SettingsSandboxPageSetBackendEnabledMutation$variables = {
  backendType: SandboxBackendType;
  enabled: boolean;
};
export type SettingsSandboxPageSetBackendEnabledMutation$data = {
  readonly setSandboxBackendEnabled: {
    readonly enabled: boolean;
    readonly id: string;
  };
};
export type SettingsSandboxPageSetBackendEnabledMutation = {
  response: SettingsSandboxPageSetBackendEnabledMutation$data;
  variables: SettingsSandboxPageSetBackendEnabledMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "backendType"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "enabled"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "backendType",
        "variableName": "backendType"
      },
      {
        "kind": "Variable",
        "name": "enabled",
        "variableName": "enabled"
      }
    ],
    "concreteType": "SandboxConfig",
    "kind": "LinkedField",
    "name": "setSandboxBackendEnabled",
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
    "name": "SettingsSandboxPageSetBackendEnabledMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SettingsSandboxPageSetBackendEnabledMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "4eb7448e09fa6ec19de0a5da7a8b3ef3",
    "id": null,
    "metadata": {},
    "name": "SettingsSandboxPageSetBackendEnabledMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsSandboxPageSetBackendEnabledMutation(\n  $backendType: SandboxBackendType!\n  $enabled: Boolean!\n) {\n  setSandboxBackendEnabled(backendType: $backendType, enabled: $enabled) {\n    id\n    enabled\n  }\n}\n"
  }
};
})();

(node as any).hash = "bbfa9537d426b6a0e27e93a985a57b22";

export default node;
