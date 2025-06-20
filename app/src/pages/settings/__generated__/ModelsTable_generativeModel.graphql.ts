/**
 * @generated SignedSource<<1d2c7e4cb9f5988e43a7592b80c5decc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
import { FragmentRefs } from "relay-runtime";
export type ModelsTable_generativeModel$data = {
  readonly createdAt: string;
  readonly id: string;
  readonly isOverride: boolean;
  readonly lastUsedAt: string | null;
  readonly name: string;
  readonly namePattern: string;
  readonly provider: string | null;
  readonly providerKey: GenerativeProviderKey | null;
  readonly tokenCost: {
    readonly cacheRead: number | null;
    readonly cacheWrite: number | null;
    readonly completionAudio: number | null;
    readonly input: number | null;
    readonly output: number | null;
    readonly promptAudio: number | null;
    readonly reasoning: number | null;
  } | null;
  readonly updatedAt: string;
  readonly " $fragmentType": "ModelsTable_generativeModel";
};
export type ModelsTable_generativeModel$key = {
  readonly " $data"?: ModelsTable_generativeModel$data;
  readonly " $fragmentSpreads": FragmentRefs<"ModelsTable_generativeModel">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "ModelsTable_generativeModel"
};

(node as any).hash = "f9dd8c9522dd8959ef12a68390498d76";

export default node;
