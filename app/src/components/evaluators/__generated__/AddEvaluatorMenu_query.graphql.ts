/**
 * @generated SignedSource<<36dd77a4ae471adec8b26b5c0dbbca07>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AddEvaluatorMenu_query$data = {
  readonly " $fragmentSpreads": FragmentRefs<"AddEvaluatorMenu_codeEvaluatorTemplates" | "AddEvaluatorMenu_llmEvaluatorTemplates">;
  readonly " $fragmentType": "AddEvaluatorMenu_query";
};
export type AddEvaluatorMenu_query$key = {
  readonly " $data"?: AddEvaluatorMenu_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"AddEvaluatorMenu_query">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "AddEvaluatorMenu_query",
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

(node as any).hash = "a4dd24fa272edf3d043b07ed8298ac86";

export default node;
