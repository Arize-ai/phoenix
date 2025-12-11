/**
 * @generated SignedSource<<ca7bb7e4bf298bedf58e3c1affd15f21>>
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
  readonly name: string;
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};

(node as any).hash = "5986509e6cf8e563520d7adaca6bc75e";

export default node;
