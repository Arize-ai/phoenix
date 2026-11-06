/**
 * @generated SignedSource<<150a4d35b3e96fcbb877265944f2f6d6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetLabelsSettingsCardFragment$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DatasetLabelsTableFragment">;
  readonly " $fragmentType": "DatasetLabelsSettingsCardFragment";
};
export type DatasetLabelsSettingsCardFragment$key = {
  readonly " $data"?: DatasetLabelsSettingsCardFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetLabelsSettingsCardFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DatasetLabelsSettingsCardFragment",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "DatasetLabelsTableFragment"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "3922211daa123323e1c2ac97b642ab76";

export default node;
