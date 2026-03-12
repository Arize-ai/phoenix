/**
 * @generated SignedSource<<f8bc22848e6d6f9db2f7224121f3f5ec>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SandboxBackendType = "DAYTONA" | "DENO" | "E2B" | "VERCEL" | "WASM";
export type UpdateSandboxConfigInput = {
  config?: any | null;
  description?: string | null;
  enabled?: boolean | null;
  id: string;
  name?: string | null;
  timeout?: number | null;
};
export type EditInstanceDialogUpdateMutation$variables = {
  input: UpdateSandboxConfigInput;
};
export type EditInstanceDialogUpdateMutation$data = {
  readonly updateSandboxConfig: {
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
export type EditInstanceDialogUpdateMutation = {
  response: EditInstanceDialogUpdateMutation$data;
  variables: EditInstanceDialogUpdateMutation$variables;
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
    "name": "EditInstanceDialogUpdateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditInstanceDialogUpdateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "5708d8e74ee0a57d23b399abfe34c0bc",
    "id": null,
    "metadata": {},
    "name": "EditInstanceDialogUpdateMutation",
    "operationKind": "mutation",
    "text": "mutation EditInstanceDialogUpdateMutation(\n  $input: UpdateSandboxConfigInput!\n) {\n  updateSandboxConfig(input: $input) {\n    id\n    backendType\n    name\n    description\n    config\n    timeout\n    enabled\n    configHash\n  }\n}\n"
  }
};
})();

(node as any).hash = "4d292e99faea190f195bc6f95e4076ca";

export default node;
