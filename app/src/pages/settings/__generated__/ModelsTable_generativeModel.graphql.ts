/**
 * @generated SignedSource<<83033f0e613f0f1bb614d49e03e37fe7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type TokenKind = "COMPLETION" | "PROMPT";
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

(node as any).hash = "f4e5e68bd29ab6bddfc1867d39b20918";

export default node;
