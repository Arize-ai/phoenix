/**
 * @generated SignedSource<<7476bb35d721b8ab7789bce19d1a5979>>
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
    readonly credentialSpecs: ReadonlyArray<{
      readonly description: string;
      readonly displayName: string;
      readonly isRequired: boolean;
      readonly key: string;
    }>;
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
  "name": "description",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "config",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
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
            (v2/*: any*/),
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
        (v3/*: any*/),
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "language",
          "storageKey": null
        },
        (v4/*: any*/),
        (v5/*: any*/),
        (v6/*: any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfig",
          "kind": "LinkedField",
          "name": "configs",
          "plural": true,
          "selections": [
            (v3/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "name",
              "storageKey": null
            },
            (v2/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "timeout",
              "storageKey": null
            },
            (v4/*: any*/),
            (v5/*: any*/),
            (v6/*: any*/)
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

(node as any).hash = "ecf4493da709473f1f05e97b6ab7e787";

export default node;
