/**
 * @generated SignedSource<<3b6de3aa90d25d164d777ff05eb1c341>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PlaygroundEvaluatorSelect_query$data = {
  readonly " $fragmentSpreads": FragmentRefs<"AddEvaluatorMenu_codeEvaluatorTemplates" | "AddEvaluatorMenu_llmEvaluatorTemplates">;
  readonly " $fragmentType": "PlaygroundEvaluatorSelect_query";
};
export type PlaygroundEvaluatorSelect_query$key = {
  readonly " $data"?: PlaygroundEvaluatorSelect_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"PlaygroundEvaluatorSelect_query">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PlaygroundEvaluatorSelect_query",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "AddEvaluatorMenu_codeEvaluatorTemplates"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "AddEvaluatorMenu_llmEvaluatorTemplates"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "c69daa9760dd776c96e0bde191e2d872";

export default node;
