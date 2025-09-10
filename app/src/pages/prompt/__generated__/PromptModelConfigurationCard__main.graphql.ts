/**
 * @generated SignedSource<<7c1196b92c3d95cfbe5afe429c2676f9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
import { FragmentRefs } from "relay-runtime";
export type PromptModelConfigurationCard__main$data = {
  readonly model: string;
  readonly provider: ModelProvider;
  readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParameters__main" | "PromptLLM__main" | "PromptResponseFormatFragment" | "PromptTools__main">;
  readonly " $fragmentType": "PromptModelConfigurationCard__main";
};
export type PromptModelConfigurationCard__main$key = {
  readonly " $data"?: PromptModelConfigurationCard__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptModelConfigurationCard__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptModelConfigurationCard__main",
  "selections": [
    {
      "alias": "model",
      "args": null,
      "kind": "ScalarField",
      "name": "modelName",
      "storageKey": null
    },
    {
      "alias": "provider",
      "args": null,
      "kind": "ScalarField",
      "name": "modelProvider",
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptLLM__main"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptInvocationParameters__main"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptTools__main"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptResponseFormatFragment"
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};

(node as any).hash = "1c4202299f1f881250b17b75244fac54";

export default node;
