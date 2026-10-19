/**
 * @generated SignedSource<<308e3c19405a423711d1e7b2623b9525>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionLabelConfigButton_decisionLabels$data = {
  readonly id: string;
  readonly labels: ReadonlyArray<{
    readonly id: string;
  }>;
  readonly " $fragmentType": "DecisionLabelConfigButton_decisionLabels";
};
export type DecisionLabelConfigButton_decisionLabels$key = {
  readonly " $data"?: DecisionLabelConfigButton_decisionLabels$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionLabelConfigButton_decisionLabels">;
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
  "name": "DecisionLabelConfigButton_decisionLabels",
  "selections": [
    (v0/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionLabel",
      "kind": "LinkedField",
      "name": "labels",
      "plural": true,
      "selections": [
        (v0/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "Decision",
  "abstractKey": null
};
})();

(node as any).hash = "ea92caf8f299239747a742a71729d10e";

export default node;
