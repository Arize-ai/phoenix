/**
 * @generated SignedSource<<cd8b4e7ef0129b46d8a9dfe5c1805c23>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetEvaluatorSpans_project$data = {
  readonly id: string;
  readonly " $fragmentSpreads": FragmentRefs<"SpansTable_spans">;
  readonly " $fragmentType": "DatasetEvaluatorSpans_project";
};
export type DatasetEvaluatorSpans_project$key = {
  readonly " $data"?: DatasetEvaluatorSpans_project$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorSpans_project">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DatasetEvaluatorSpans_project",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "SpansTable_spans"
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "e78d81d15386e407dbde57bf1ae1a11e";

export default node;
