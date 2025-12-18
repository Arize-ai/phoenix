/**
 * @generated SignedSource<<87f4ecb68982ac4569d5e69d8c9194e5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CreateBuiltInDatasetEvaluatorSlideover_dataset$data = {
  readonly id: string;
  readonly " $fragmentType": "CreateBuiltInDatasetEvaluatorSlideover_dataset";
};
export type CreateBuiltInDatasetEvaluatorSlideover_dataset$key = {
  readonly " $data"?: CreateBuiltInDatasetEvaluatorSlideover_dataset$data;
  readonly " $fragmentSpreads": FragmentRefs<"CreateBuiltInDatasetEvaluatorSlideover_dataset">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "CreateBuiltInDatasetEvaluatorSlideover_dataset",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};

(node as any).hash = "32aed2a9c220563dd7905efb3a938e06";

export default node;
