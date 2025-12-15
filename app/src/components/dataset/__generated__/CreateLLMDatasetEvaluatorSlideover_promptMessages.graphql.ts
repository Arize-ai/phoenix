/**
 * @generated SignedSource<<c104350c558de89ceeed971a89ca1db3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
import { FragmentRefs } from "relay-runtime";
export type CreateLLMDatasetEvaluatorSlideover_promptMessages$data = {
  readonly content: ReadonlyArray<{
    readonly text?: {
      readonly text: string;
    };
  }>;
  readonly role: PromptMessageRole;
  readonly " $fragmentType": "CreateLLMDatasetEvaluatorSlideover_promptMessages";
};
export type CreateLLMDatasetEvaluatorSlideover_promptMessages$key = {
  readonly " $data"?: CreateLLMDatasetEvaluatorSlideover_promptMessages$data;
  readonly " $fragmentSpreads": FragmentRefs<"CreateLLMDatasetEvaluatorSlideover_promptMessages">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "CreateLLMDatasetEvaluatorSlideover_promptMessages"
};

(node as any).hash = "763bd8660d7d58fa52cc5340c4405d91";

export default node;
