/**
 * @generated SignedSource<<cda352f99f5bccbfd8756cfd4b9c3852>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorConfigDialog_dataset$data = {
  readonly id: string;
  readonly name: string;
  readonly " $fragmentType": "EvaluatorConfigDialog_dataset";
};
export type EvaluatorConfigDialog_dataset$key = {
  readonly " $data"?: EvaluatorConfigDialog_dataset$data;
  readonly " $fragmentSpreads": FragmentRefs<"EvaluatorConfigDialog_dataset">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "EvaluatorConfigDialog_dataset",
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

(node as any).hash = "c2917bc095b524fb72c13017c63cf995";

export default node;
