/**
 * @generated SignedSource<<1ad430d5da2a58cca7a5666eeb7d1ca4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
import { FragmentRefs } from "relay-runtime";
export type GenerativeProvidersCard_data$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly apiKeyEnvVar: string;
    readonly apiKeySet: boolean;
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
          "kind": "ScalarField",
          "name": "apiKeyEnvVar",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "apiKeySet",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "0168d590171b96e7a2e41449a41754be";

export default node;
