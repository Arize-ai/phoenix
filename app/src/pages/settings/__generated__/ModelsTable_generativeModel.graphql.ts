/**
 * @generated SignedSource<<a6d6541face182021ccea894c169eed9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type GenerativeModelKind = "BUILT_IN" | "CUSTOM";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type TokenKind = "COMPLETION" | "PROMPT";
import { FragmentRefs } from "relay-runtime";
export type ModelsTable_generativeModel$data = {
  readonly createdAt: string;
  readonly id: string;
  readonly kind: GenerativeModelKind;
  readonly lastUsedAt: string | null;
  readonly name: string;
  readonly namePattern: string;
  readonly provider: string | null;
  readonly providerKey: GenerativeProviderKey | null;
  readonly startTime: string | null;
  readonly tokenPrices: ReadonlyArray<{
    readonly costPerMillionTokens: number;
    readonly costPerToken: number;
    readonly kind: TokenKind;
    readonly tokenType: string;
  }>;
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

(node as any).hash = "a6553f7ef7c7bc775e32859a2637076e";

export default node;
