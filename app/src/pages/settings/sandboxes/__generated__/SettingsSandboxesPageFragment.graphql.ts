/**
 * @generated SignedSource<<0f6f6a12695141fa562ec06945810b44>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type InternetAccessMode = "ALLOWLIST" | "BOOLEAN" | "NONE";
export type Language = "PYTHON" | "TYPESCRIPT";
export type SandboxBackendStatus = "AVAILABLE" | "MISSING_CREDENTIALS" | "NOT_INSTALLED" | "UNAVAILABLE";
import { FragmentRefs } from "relay-runtime";
export type SettingsSandboxesPageFragment$data = {
  readonly sandboxBackends: ReadonlyArray<{
    readonly backendType: string;
    readonly dependenciesLanguage: Language | null;
    readonly dependencyHints: ReadonlyArray<string>;
    readonly displayName: string;
    readonly internetAccess: InternetAccessMode;
    readonly status: SandboxBackendStatus;
    readonly statusDetail: string | null;
    readonly supportedLanguages: ReadonlyArray<Language>;
    readonly supportsEnvVars: boolean;
  }>;
  readonly sandboxProviders: ReadonlyArray<{
    readonly backendType: string;
    readonly config: any;
    readonly configs: ReadonlyArray<{
      readonly config: any;
      readonly description: string | null;
      readonly enabled: boolean;
      readonly id: string;
      readonly name: string;
      readonly timeout: number;
      readonly updatedAt: string;
    }>;
    readonly enabled: boolean;
    readonly id: string;
    readonly language: Language;
    readonly updatedAt: string;
  }>;
  readonly " $fragmentType": "SettingsSandboxesPageFragment";
};
export type SettingsSandboxesPageFragment$key = {
  readonly " $data"?: SettingsSandboxesPageFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"SettingsSandboxesPageFragment">;
};

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
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "config",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
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
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "displayName",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "dependencyHints",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "supportedLanguages",
          "storageKey": null
        },
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
          "name": "dependenciesLanguage",
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
        (v1/*: any*/),
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "language",
          "storageKey": null
        },
        (v2/*: any*/),
        (v3/*: any*/),
        (v4/*: any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfig",
          "kind": "LinkedField",
          "name": "configs",
          "plural": true,
          "selections": [
            (v1/*: any*/),
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
              "name": "timeout",
              "storageKey": null
            },
            (v2/*: any*/),
            (v3/*: any*/),
            (v4/*: any*/)
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

(node as any).hash = "fbfdf2c6bcd4f7119c65cc9dbcf52876";

export default node;
