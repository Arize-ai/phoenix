/**
 * @generated SignedSource<<16d16a4a2b8e0c009541596b05e88362>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
import { FragmentRefs } from "relay-runtime";
export type PromptLLM__main$data = {
  readonly model: string;
  readonly provider: ModelProvider;
  readonly " $fragmentType": "PromptLLM__main";
};
export type PromptLLM__main$key = {
  readonly " $data"?: PromptLLM__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptLLM__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptLLM__main",
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
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};

(node as any).hash = "acc90da43126218472d2fc19cd8d0512";

export default node;
