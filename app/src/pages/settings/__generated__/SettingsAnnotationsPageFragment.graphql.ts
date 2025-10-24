/**
 * @generated SignedSource<<f93bfeb076e4a2e680a84fc11eb96936>>
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

import SettingsAnnotationsPageFragmentQuery_graphql from './SettingsAnnotationsPageFragmentQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": SettingsAnnotationsPageFragmentQuery_graphql
    }
  },
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

(node as any).hash = "1108c006f0bdef6068549534988a5206";

export default node;
