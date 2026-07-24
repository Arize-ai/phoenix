/**
 * @generated SignedSource<<8cf36904b68ebbd4792836ea3264f307>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type InternetAccessChoice = "ALLOW" | "DENY";
export type InternetAccessMode = "BOOLEAN" | "NONE";
export type Language = "PYTHON" | "TYPESCRIPT";
export type SandboxBackendStatus = "AVAILABLE" | "DISABLED" | "MISSING_CREDENTIALS" | "NOT_INSTALLED" | "UNAVAILABLE";
export type SandboxBackendType = "DAYTONA" | "DENO" | "E2B" | "MODAL" | "TENKI" | "VERCEL" | "WASM";
export type SandboxHostingType = "HOSTED" | "LOCAL";
import { FragmentRefs } from "relay-runtime";
export type SettingsSandboxesPageFragment$data = {
  readonly sandboxBackends: ReadonlyArray<{
    readonly backendType: SandboxBackendType;
    readonly credentialSpecs: ReadonlyArray<{
      readonly description: string;
      readonly displayName: string;
      readonly isRequired: boolean;
      readonly key: string;
    }>;
    readonly dependencyHints: ReadonlyArray<string>;
    readonly displayName: string;
    readonly hostingType: SandboxHostingType;
    readonly internetAccess: InternetAccessMode;
    readonly status: SandboxBackendStatus;
    readonly statusDetail: string | null;
    readonly supportedLanguages: ReadonlyArray<Language>;
    readonly supportsDependencies: boolean;
    readonly supportsEnvVars: boolean;
  }>;
  readonly sandboxProviders: ReadonlyArray<{
    readonly backendType: SandboxBackendType;
    readonly configs: ReadonlyArray<{
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
      readonly enabled: boolean;
      readonly id: string;
      readonly language: Language;
      readonly name: string;
      readonly timeout: number;
      readonly updatedAt: string;
    }>;
    readonly enabled: boolean;
    readonly id: string;
    readonly supportedLanguages: ReadonlyArray<Language>;
  }>;
  readonly " $fragmentType": "SettingsSandboxesPageFragment";
};
export type SettingsSandboxesPageFragment$key = {
  readonly " $data"?: SettingsSandboxesPageFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"SettingsSandboxesPageFragment">;
};

import SettingsSandboxesPageRefetchQuery_graphql from './SettingsSandboxesPageRefetchQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "displayName",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "supportedLanguages",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": SettingsSandboxesPageRefetchQuery_graphql
    }
  },
  "name": "SettingsSandboxesPageFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "SandboxBackendInfo",
      "kind": "LinkedField",
      "name": "sandboxBackends",
      "plural": true,
      "selections": [
        (v0/*:: as any*/),
        (v1/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "hostingType",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "dependencyHints",
          "storageKey": null
        },
        (v2/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "status",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "statusDetail",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "supportsEnvVars",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "internetAccess",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "supportsDependencies",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxProviderCredentialSpec",
          "kind": "LinkedField",
          "name": "credentialSpecs",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "key",
              "storageKey": null
            },
            (v1/*:: as any*/),
            (v3/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "isRequired",
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
      "name": "sandboxProviders",
      "plural": true,
      "selections": [
        (v4/*:: as any*/),
        (v0/*:: as any*/),
        (v2/*:: as any*/),
        (v5/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfig",
          "kind": "LinkedField",
          "name": "configs",
          "plural": true,
          "selections": [
            (v4/*:: as any*/),
            (v6/*:: as any*/),
            (v3/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "language",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "timeout",
              "storageKey": null
            },
            (v5/*:: as any*/),
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
                    (v6/*:: as any*/),
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
              "kind": "ScalarField",
              "name": "updatedAt",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "3d2272767b923b1414b367e3c3cba621";

export default node;
