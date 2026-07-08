/**
 * @generated SignedSource<<f1ded1ae57484fce3c9029ee1374ba08>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetLabelConfigButton_datasetLabels$data = {
  readonly id: string;
  readonly labels: ReadonlyArray<{
    readonly id: string;
  }>;
  readonly " $fragmentType": "DatasetLabelConfigButton_datasetLabels";
};
export type DatasetLabelConfigButton_datasetLabels$key = {
  readonly " $data"?: DatasetLabelConfigButton_datasetLabels$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetLabelConfigButton_datasetLabels">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DatasetLabelConfigButton_datasetLabels",
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetLabel",
      "kind": "LinkedField",
      "name": "labels",
      "plural": true,
      "selections": [
        (v0/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};
})();

(node as any).hash = "379d5b11b6b9a7cb01deea2bcec9e022";

export default node;
