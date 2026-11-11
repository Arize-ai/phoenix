/**
 * @generated SignedSource<<f6849076d283d657684ed381fc659230>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI" | "ZAI";
import { FragmentRefs } from "relay-runtime";
export type GenerativeProvidersCard_data$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly credentialRequirements: ReadonlyArray<{
      readonly envVarName: string;
      readonly isRequired: boolean;
      readonly isSetInServerEnvironment: boolean;
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

import GenerativeProvidersCardRefetchQuery_graphql from './GenerativeProvidersCardRefetchQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": GenerativeProvidersCardRefetchQuery_graphql
    }
  },
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
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "isSetInServerEnvironment",
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

(node as any).hash = "90505b62d6c29e5583fccf62df111f09";

export default node;
