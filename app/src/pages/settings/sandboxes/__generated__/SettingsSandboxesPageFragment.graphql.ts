/**
 * @generated SignedSource<<1add26b747b9cb3dfc6dab76e09ed747>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type InternetAccessChoice = "ALLOW" | "DENY";
export type InternetAccessMode = "ALLOWLIST" | "BOOLEAN" | "NONE";
export type Language = "PYTHON" | "TYPESCRIPT";
export type SandboxBackendStatus = "AVAILABLE" | "MISSING_CREDENTIALS" | "NOT_INSTALLED" | "UNAVAILABLE";
export type SandboxHostingType = "HOSTED" | "LOCAL";
export type SandboxProviderKind = "DAYTONA" | "DENO" | "E2B" | "MODAL" | "VERCEL" | "WASM";
import { FragmentRefs } from "relay-runtime";
export type SettingsSandboxesPageFragment$data = {
  readonly sandboxBackends: ReadonlyArray<{
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
    readonly kind: SandboxProviderKind;
    readonly status: SandboxBackendStatus;
    readonly statusDetail: string | null;
    readonly supportedLanguages: ReadonlyArray<Language>;
    readonly supportsDependencies: boolean;
    readonly supportsEnvVars: boolean;
  }>;
  readonly sandboxProviders: ReadonlyArray<{
    readonly configs: ReadonlyArray<{
      readonly config: {
        readonly dependencies: {
          readonly packages: ReadonlyArray<string>;
        } | null;
        readonly envVars: ReadonlyArray<{
          readonly name: string;
          readonly value: {
            readonly __typename: "SandboxConfigEnvVarLiteral";
            readonly literal: string;
          } | {
            readonly __typename: "SandboxConfigEnvVarSecretRef";
            readonly secretKey: string;
          } | {
            // This will never be '%other', but we need some
            // value in case none of the concrete values match.
            readonly __typename: "%other";
          };
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
    readonly kind: SandboxProviderKind;
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
  "name": "kind",
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
        (v0/*: any*/),
        (v1/*: any*/),
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
        (v2/*: any*/),
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
            (v1/*: any*/),
            (v3/*: any*/),
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
        (v4/*: any*/),
        (v0/*: any*/),
        (v2/*: any*/),
        (v5/*: any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfig",
          "kind": "LinkedField",
          "name": "configs",
          "plural": true,
          "selections": [
            (v4/*: any*/),
            (v6/*: any*/),
            (v3/*: any*/),
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
            (v5/*: any*/),
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
                    (v6/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": null,
                      "kind": "LinkedField",
                      "name": "value",
                      "plural": false,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "__typename",
                          "storageKey": null
                        },
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "literal",
                              "storageKey": null
                            }
                          ],
                          "type": "SandboxConfigEnvVarLiteral",
                          "abstractKey": null
                        },
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "secretKey",
                              "storageKey": null
                            }
                          ],
                          "type": "SandboxConfigEnvVarSecretRef",
                          "abstractKey": null
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

(node as any).hash = "02b83db166418906db0308ae4a489d97";

export default node;
