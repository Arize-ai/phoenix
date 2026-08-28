/**
 * @generated SignedSource<<8f4a336293148ce6076889710221a3a6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type InternetAccessChoice = "ALLOW" | "DENY";
export type SandboxBackendType = "DAYTONA" | "DENO" | "E2B" | "MODAL" | "MONTY" | "VERCEL" | "WASM";
import { FragmentRefs } from "relay-runtime";
export type CodeEvaluatorSandboxCard_sandboxConfig$data = {
  readonly config: {
    readonly dependencies: {
      readonly packages: ReadonlyArray<string>;
    } | null;
    readonly envVars: ReadonlyArray<{
      readonly name: string;
      readonly secretKey: string;
    }>;
    readonly internetAccess: {
      readonly mode: InternetAccessChoice;
    } | null;
  };
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly provider: {
    readonly backendType: SandboxBackendType;
  };
  readonly timeout: number;
  readonly " $fragmentType": "CodeEvaluatorSandboxCard_sandboxConfig";
};
export type CodeEvaluatorSandboxCard_sandboxConfig$key = {
  readonly " $data"?: CodeEvaluatorSandboxCard_sandboxConfig$data;
  readonly " $fragmentSpreads": FragmentRefs<"CodeEvaluatorSandboxCard_sandboxConfig">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "CodeEvaluatorSandboxCard_sandboxConfig",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    (v0/*:: as any*/),
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
      "name": "timeout",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "SandboxConfigData",
      "kind": "LinkedField",
      "name": "config",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfigEnvVar",
          "kind": "LinkedField",
          "name": "envVars",
          "plural": true,
          "selections": [
            (v0/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "secretKey",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfigInternetAccess",
          "kind": "LinkedField",
          "name": "internetAccess",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "mode",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfigDependencies",
          "kind": "LinkedField",
          "name": "dependencies",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "packages",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "SandboxProvider",
      "kind": "LinkedField",
      "name": "provider",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "backendType",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "SandboxConfig",
  "abstractKey": null
};
})();

(node as any).hash = "9fe39016ad199df9fcf791f11c20f816";

export default node;
