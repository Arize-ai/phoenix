/**
 * @generated SignedSource<<b906b5c2fbea428abfe5d6894ca45a5a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SettingsAnnotationsPageFragment$data = {
  readonly " $fragmentSpreads": FragmentRefs<"AnnotationConfigTableFragment">;
  readonly " $fragmentType": "SettingsAnnotationsPageFragment";
};
export type SettingsAnnotationsPageFragment$key = {
  readonly " $data"?: SettingsAnnotationsPageFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"SettingsAnnotationsPageFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SettingsAnnotationsPageFragment",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "AnnotationConfigTableFragment"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "899b97b5d6aabeea206cd9b4ffb1a773";

export default node;
