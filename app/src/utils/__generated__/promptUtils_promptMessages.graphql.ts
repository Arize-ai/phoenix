/**
 * @generated SignedSource<<53cf7af035db37effd77a6b77ce4797b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
import { FragmentRefs } from "relay-runtime";
export type promptUtils_promptMessages$data = {
  readonly content: ReadonlyArray<{
    readonly text?: {
      readonly text: string;
    };
  }>;
  readonly role: PromptMessageRole;
  readonly " $fragmentType": "promptUtils_promptMessages";
};
export type promptUtils_promptMessages$key = {
  readonly " $data"?: promptUtils_promptMessages$data;
  readonly " $fragmentSpreads": FragmentRefs<"promptUtils_promptMessages">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "promptUtils_promptMessages"
};

(node as any).hash = "5db150860a995de3213f6f2d02a10506";

export default node;
