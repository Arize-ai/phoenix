/**
 * @generated SignedSource<<54c67ee0bce310e7b6d779e33a061c16>>
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
    readonly file?: {
      readonly __typename: "ImageContentValue";
      readonly mediaType: string;
      readonly url: string;
    } | {
      readonly __typename: "ImageVariableValue";
      readonly variable: string;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    };
    readonly image?: {
      readonly __typename: "ImageContentValue";
      readonly mediaType: string;
      readonly url: string;
    } | {
      readonly __typename: "ImageVariableValue";
      readonly variable: string;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
    };
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

(node as any).hash = "6f834007f46c96bdd5f0aa9b10598d60";

export default node;
