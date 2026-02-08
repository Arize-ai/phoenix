/**
 * @generated SignedSource<<1d22fc90b4d3a1fd21dcf95ce024b517>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "XAI";
import { FragmentRefs } from "relay-runtime";
export type GenerativeProvidersCard_data$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly credentialRequirements: ReadonlyArray<{
      readonly envVarName: string;
      readonly isRequired: boolean;
    }>;
    readonly credentialsSet: boolean;
    readonly dependencies: ReadonlyArray<string>;
    readonly dependenciesInstalled: boolean;
    readonly key: GenerativeProviderKey;
    readonly name: string;
  }>;
  readonly " $fragmentType": "GenerativeProvidersCard_data";
};
export type GenerativeProvidersCard_data$key = {
  readonly " $data"?: GenerativeProvidersCard_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"GenerativeProvidersCard_data">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "GenerativeProvidersCard_data",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "GenerativeProvider",
      "kind": "LinkedField",
      "name": "modelProviders",
      "plural": true,
      "selections": [
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
          "name": "key",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "dependenciesInstalled",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "dependencies",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "GenerativeProviderCredentialConfig",
          "kind": "LinkedField",
          "name": "credentialRequirements",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "envVarName",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "isRequired",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "credentialsSet",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "4062531cfa3f77e541172a44101f5331";

export default node;
