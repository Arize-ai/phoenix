/**
 * @generated SignedSource<<9db5417ea510c52a55a92eee37bad681>>
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
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "b15c9caa847912fdb7b07a0c01a69ed9";

export default node;
