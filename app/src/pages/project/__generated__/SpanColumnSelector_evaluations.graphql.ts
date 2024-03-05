/**
 * @generated SignedSource<<2569806cc3e1f358f0d70c528aed6826>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SpanColumnSelector_evaluations$data = {
  readonly spanEvaluationNames: ReadonlyArray<string>;
  readonly " $fragmentType": "SpanColumnSelector_evaluations";
};
export type SpanColumnSelector_evaluations$key = {
  readonly " $data"?: SpanColumnSelector_evaluations$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanColumnSelector_evaluations">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SpanColumnSelector_evaluations",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "spanEvaluationNames",
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "6cb10f157751687d641be9002cfb97a8";

export default node;
