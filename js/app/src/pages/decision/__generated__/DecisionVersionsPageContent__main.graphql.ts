/**
 * @generated SignedSource<<458d3cc93ce1e7544bf915d8de03617f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionVersionsPageContent__main$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionsList__main">;
  readonly " $fragmentType": "DecisionVersionsPageContent__main";
};
export type DecisionVersionsPageContent__main$key = {
  readonly " $data"?: DecisionVersionsPageContent__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionsPageContent__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionVersionsPageContent__main",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "DecisionVersionsList__main"
    }
  ],
  "type": "Decision",
  "abstractKey": null
};

(node as any).hash = "b68b52214be43ea481e0dc3a5867ec15";

export default node;
