/**
 * @generated SignedSource<<9a9260035ffcece727d7d5e778773879>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
import { FragmentRefs } from "relay-runtime";
export type DecisionModelConfigurationCard_version$data = {
  readonly customProvider: {
    readonly name: string;
  } | null;
  readonly decisionModelProvider: GenerativeProviderKey;
  readonly modelName: string;
  readonly " $fragmentType": "DecisionModelConfigurationCard_version";
};
export type DecisionModelConfigurationCard_version$key = {
  readonly " $data"?: DecisionModelConfigurationCard_version$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionModelConfigurationCard_version">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionModelConfigurationCard_version",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "modelName",
      "storageKey": null
    },
    {
      "alias": "decisionModelProvider",
      "args": null,
      "kind": "ScalarField",
      "name": "modelProvider",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "GenerativeModelCustomProvider",
      "kind": "LinkedField",
      "name": "customProvider",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DecisionVersion",
  "abstractKey": null
};

(node as any).hash = "c4473c5b39cc969fc459ba74e09ee1a5";

export default node;
