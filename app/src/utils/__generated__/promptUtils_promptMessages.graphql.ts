/**
 * @generated SignedSource<<16d1b6f447856d60ace3d15d946cafe8>>
 * @lightSyntaxTransform
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
    readonly " $fragmentSpreads": FragmentRefs<"mediaContentPartFragment">;
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

(node as any).hash = "09443bb77e4104525ab8147af640a9f3";

export default node;
