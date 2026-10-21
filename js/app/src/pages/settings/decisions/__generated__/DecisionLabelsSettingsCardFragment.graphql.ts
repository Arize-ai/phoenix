/**
 * @generated SignedSource<<aecb0db94189f86c840572803f58d4f3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionLabelsSettingsCardFragment$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DecisionLabelsTableFragment">;
  readonly " $fragmentType": "DecisionLabelsSettingsCardFragment";
};
export type DecisionLabelsSettingsCardFragment$key = {
  readonly " $data"?: DecisionLabelsSettingsCardFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionLabelsSettingsCardFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionLabelsSettingsCardFragment",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "DecisionLabelsTableFragment"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "aba72047cf9b00eedcd3069cae80eafc";

export default node;
