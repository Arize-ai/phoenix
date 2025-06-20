/**
 * @generated SignedSource<<ff065a71cdd84e007476428579a4a584>>
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
  readonly costDetailSummaryEntries: ReadonlyArray<{
    readonly isPrompt: boolean;
    readonly tokenType: string;
    readonly value: {
      readonly cost: number | null;
      readonly costPerToken: number | null;
      readonly tokens: number | null;
    };
  }>;
  readonly createdAt: string;
  readonly id: string;
  readonly isOverride: boolean;
  readonly lastUsedAt: string | null;
  readonly name: string;
  readonly namePattern: string;
  readonly provider: string | null;
  readonly providerKey: GenerativeProviderKey | null;
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

(node as any).hash = "b07cd08465d7ab17eef1d56ee5cd2143";

export default node;
